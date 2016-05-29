import fs from 'fs'
import gu from 'koa-gu'
import rp from 'request-promise'
import archieml from 'archieml'
import XLSX from 'xlsx'
import denodeify from 'denodeify'
import google from 'googleapis'
import { Converter } from 'csvtojson'
import { jwtClient } from './auth.js'
import { _ } from 'lodash'
import Baby from 'babyparse'
import sheet_to_json from './sheet_to_json'

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

    static async getTokens() {
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

    async update({fetchAll = false, fileId = ''}) {
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
            var tokens = await FileManager.getTokens();
            var changedFiles = changeList.items.map(change => change.file).filter(f => f)
            var ids = changedFiles.map(file => file.id)
            var existing = await FileManager.getGuFiles(ids);
            existing.forEach((guFile, i) => guFile && (guFile.metaData = changedFiles[i])) // update existing
            var guFiles = existing
                .map((guFile, i) => guFile || GuFile.deserialize({metaData: changedFiles[i]})) // create new
                .filter(guFile => !!guFile) // filter any broken / unrecognized

            if (guFiles.length) {
                for (var i = 0; i < guFiles.length; i++) {
                    if (fileId && guFiles[i].id !== fileId) continue;
                    await guFiles[i].update(tokens).catch(err => {
                        gu.log.error('Failed to update', guFiles[i].title)
                        gu.log.error('Error:', err);
                        if (err && err.stack) {
                            gu.log.error(err.stack);
                        }
                    });
                }
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

    async update(tokens) {
        gu.log.info(`Updating ${this.title}`);

        this.rawBody = await this.fetchFileJSON(tokens);
        this.domainPermissions = await this.fetchDomainPermissions();
        return this.uploadToS3(false);
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
    fetchFileJSON(tokens) {
      return rp({
          uri: this.metaData.exportLinks['text/plain'],
          headers: {
              'Authorization': tokens.token_type + ' ' + tokens.access_token
          }
      });
    }

    get archieJSON() { return archieml.load(this.rawBody) }

    get stringBody() { return JSON.stringify(this.archieJSON); }
}

export class SheetsFile extends GuFile {
    async fetchFileJSON(tokens) {
        var sheetODS = await rp({
            'uri': this.metaData.exportLinks['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
            'headers': {
                'Authorization': tokens.token_type + ' ' + tokens.access_token
            },
            'encoding': null
        });
        var sheets = _.mapValues(XLSX.read(sheetODS).Sheets, (sheet, sheetName) => {
            var header = sheetName === 'tableDataSheet' ? 1 : undefined;
            return sheet_to_json(sheet, {header});
        })
        return {sheets};
    }

    get stringBody() { return JSON.stringify(this.rawBody); }
}
