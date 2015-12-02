import fs from 'fs'
import gu from 'koa-gu'
import rp from 'request-promise'
import archieml from 'archieml'
import denodeify from 'denodeify'
import google from 'googleapis'
import { Converter } from 'csvtojson'
import { jwtClient } from './auth.js'
import { _ } from 'lodash'
import Baby from 'babyparse'

var drive = google.drive('v2')
var key = require('../key.json');

export class FileManager {
    constructor() {
    }

    static async getStateDb() {
        var stateDbString = await gu.db.get(gu.config.dbkey);
        return stateDbString ? JSON.parse(stateDbString) :
                                { lastChangeId: 0, lastSaved: new Date('1900-01-01') }
    }

    static async saveStateDb(db) {
        db.lastSaved = new Date();
        return gu.db.set(gu.config.dbkey, JSON.stringify(db));
    }

    static async getGuFiles(ids) {
        var keys = ids.map(id => `${gu.config.dbkey}:${id}`)
        var strs = await gu.db.mget.call(gu.db, keys);
        var jsons = strs.map(JSON.parse);
        return jsons.map(json => json && GuFile.deserialize(json));
    }

    static async getAllGuFiles(start = 0, end = -1) {
        var ids = await gu.db.zrevrange(`${gu.config.dbkey}:index`, start, end);
        return ids.length ? await FileManager.getGuFiles(ids) : [];
    }

    static async saveGuFiles(files) {
        var saveArgs = _.flatten( files.map(file => [`${gu.config.dbkey}:${file.id}`, file.serialize()]) )
        await gu.db.mset.call(gu.db, saveArgs);

        var indexArgs = _.flatten( files.map(file => [file.unixdate, file.id]) )
        indexArgs.unshift(`${gu.config.dbkey}:index`)
        await gu.db.zadd.call(gu.db, indexArgs);
    }

    async getTokens() {
        var promiseFn = denodeify(jwtClient.authorize.bind(jwtClient))
        return await promiseFn();
    }

    async fetchRecentChanges(startChangeId) {
        return new Promise(resolve => {
            var opts = {auth:jwtClient, startChangeId: startChangeId, maxResults: 25};
            drive.changes.list(opts, (err, resp) => {
                if (err) { console.error(err); process.exit(1); }
                resolve(resp);
            });
        })
    }

    async fetchAllChanges() {
        let requestSize = 1000;
        return new Promise(resolve => {
            var retrievePageOfChanges = function(requestOpts, items, largestChangeId) {
                drive.changes.list(requestOpts, (err, resp) => {
                    if (err) { console.error(err); process.exit(1); }
                    items = items.concat(resp.items);
                    largestChangeId = resp.largestChangeId ? Math.max(resp.largestChangeId, largestChangeId) : largestChangeId;
                    var nextPageToken = resp.nextPageToken;
                    if (nextPageToken) {
                        retrievePageOfChanges(
                            {auth: jwtClient, maxResults: requestSize, pageToken: nextPageToken},
                            items, largestChangeId);
                    } else resolve({items: items, largestChangeId: largestChangeId});
                })
            }
            retrievePageOfChanges({auth:jwtClient, maxResults: requestSize}, [], 0);
        });
    }

    async update({fetchAll = false}) {
        var db = await FileManager.getStateDb();
        var changeList;
        if (fetchAll) {
            changeList = await this.fetchAllChanges();
            gu.log.info(`${changeList.items.length} changes. Largest ChangeId: ${changeList.largestChangeId}`)
        } else {
            var startChangeId = 1 + Number(db.lastChangeId);
            changeList = await this.fetchRecentChanges(startChangeId);
            gu.log.info(`${changeList.items.length} new changes since ChangeId ${startChangeId}. Largest ChangeId: ${changeList.largestChangeId}`)
        }

        if (changeList.items.length > 0) {
            var tokens = await this.getTokens();
            var changedFiles = changeList.items.map(change => change.file).filter(f => f)
            var ids = changedFiles.map(file => file.id)
            var existing = await FileManager.getGuFiles(ids);
            existing.forEach((guFile, i) => guFile && (guFile.metaData = changedFiles[i])) // update existing
            var guFiles = existing
                .map((guFile, i) => guFile || GuFile.deserialize({metaData: changedFiles[i]})) // create new
                .filter(guFile => !!guFile) // filter any broken / unrecognized

            if (guFiles.length) {
                for (var i = 0; i < guFiles.length; i++)
                    await guFiles[i].update(tokens);
                await FileManager.saveGuFiles(guFiles);
            }
        }

        db.lastChangeId = changeList.largestChangeId;
        await FileManager.saveStateDb(db);
    }
}

export class GuFile {
    constructor({metaData, lastUploadTest = null, lastUploadProd = null, rawBody = '', domainPermissions = 'unknown'}) {
        this.metaData = metaData;
        this.lastUploadTest = lastUploadTest
        this.lastUploadProd = lastUploadProd
        this.domainPermissions = domainPermissions
        this.rawBody = rawBody;
    }

    get id() { return this.metaData.id }
    get title() { return this.metaData.title }

    get pathTest() { return `${gu.config.testFolder}/${this.id}.json` }
    get urlTest() { return `${gu.config.s3domain}/${this.pathTest}` }

    get pathProd() { return `${gu.config.prodFolder}/${this.id}.json` }
    get urlProd() { return `${gu.config.s3domain}/${this.pathProd}` }

    get urlDocs() { return this.metaData.alternateLink; }

    get unixdate() { return Date.parse(this.metaData.modifiedDate); }

    isTestCurrent() { return this.lastUploadTest === this.metaData.modifiedDate }
    isProdCurrent() { return this.lastUploadProd === this.metaData.modifiedDate }

    static get types() {
        return {
            'application/vnd.google-apps.spreadsheet': SheetsFile,
            'application/vnd.google-apps.document': DocsFile
        };
    }

    static deserialize(json) {
        var FileClass = this.types[json.metaData.mimeType];
        if (!FileClass) gu.log.warn(`mimeType ${json.metaData.mimeType} not recognized`);
        else return new FileClass(json);
    }

    serialize() {
        return JSON.stringify({
            metaData: this.metaData,
            rawBody: this.rawBody,
            lastUploadTest: this.lastUploadTest,
            lastUploadProd: this.lastUploadProd,
            domainPermissions: this.domainPermissions
        });
    }

    async fetchDomainPermissions() {
        if (gu.config.requireDomainPermissions) {
            var listPermissions = denodeify(drive.permissions.list);
            var perms = await listPermissions({auth: jwtClient, fileId: this.id});
            var domainPermission = perms.items.find(i => i.name === gu.config.requireDomainPermissions)
            if (domainPermission) return domainPermission.role;
            else if(perms.items.find(i => i.emailAddress === key.client_email)) {
                return 'none';
            } else return 'unknown';
        } else return 'disabled';
    }

    uploadToS3(prod=false) {
        var uploadPath = prod ? this.pathProd : this.pathTest;
        var params = {
            Bucket: gu.config.s3bucket,
            Key: uploadPath,
            Body: this.stringBody,
            ACL: 'public-read',
            ContentType: 'application/json',
            CacheControl: prod ? 'max-age=30' : 'max-age=5'
        }
        var promise = gu.s3.putObject(params);
        promise.then(_ =>
            this[prod ? 'lastUploadProd' : 'lastUploadTest'] = this.metaData.modifiedDate);
        promise.then(_ => gu.log.info(`Uploaded ${this.title} to ${uploadPath}`))
        return promise;
    }
}
export class DocsFile extends GuFile {

    get archieJSON() { return archieml.load(this.rawBody) }

    async update(tokens) {
        this.rawBody = await this.fetchFileBody(tokens);
        this.domainPermissions = await this.fetchDomainPermissions();
        return this.uploadToS3(false);
    }

    fetchFileBody(tokens) {
      return rp({
          uri: this.metaData.exportLinks['text/plain'],
          headers: {
              'Authorization': tokens.token_type + ' ' + tokens.access_token
          }
      });
    }

    get stringBody() { return JSON.stringify(this.archieJSON); }
}

export class SheetsFile extends GuFile {

    async getSheetCsvGid(tokens) {
        var embedHTML = await rp({
            uri: this.metaData.embedLink,
            headers: {
                'Authorization': tokens.token_type + ' ' + tokens.access_token
            }
        });
        var gidRegex = /gid=(\d+)/g,
            nameRegex = /(name: ")([^"]*)/g;

        var gidMatch, gids = [], nameMatch, sheetNames = [];
        while (gidMatch = gidRegex.exec(embedHTML)) gids.push(gidMatch[1]);
        while (nameMatch = nameRegex.exec(embedHTML)) sheetNames.push(nameMatch[2]);

        this.gidNames = _.object(gids, sheetNames);
        this.sheetNames = sheetNames;

        return gids;
    }

    async getSheetAsJson(gid, tokens) {
        var baseUrl = this.metaData.exportLinks['text/csv'],
            json,
            csv = await rp({
                uri: `${baseUrl}&gid=${gid}`,
                headers: {
                    'Authorization': tokens.token_type + ' ' + tokens.access_token
                }
            });
        var converter = new Converter({constructResult:true});
        var csvToJson = denodeify(converter.fromString.bind(converter));

        json = Baby.parse(csv, { header: this.gidNames[gid] !== "tableDataSheet" });

        return json.data;
    }

    get stringBody() { return JSON.stringify(this.rawBody); }

    async update(tokens) {
        var sheetUrls = await this.getSheetCsvGid(tokens);
        var sheetJsons = await Promise.all(sheetUrls.map(url => this.getSheetAsJson(url, tokens)))
        this.rawBody = { sheets: _.zipObject(this.sheetNames, sheetJsons) };
        this.domainPermissions = await this.fetchDomainPermissions();
        return this.uploadToS3(false);
    }
}
