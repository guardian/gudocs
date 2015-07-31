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

    *getDb() {
        var db = (yield gu.db.getObj(gu.config.dbkey)) || { files: {} };
        console.log(`${Object.keys(db.files).length} entries in db`)
        return db;
    }

    *saveDb(db) {
        db.lastSaved = new Date();
        return gu.db.setObj(gu.config.dbkey, db);
    }

    *getTokens() {
        return (yield jwtClient.authorize.bind(jwtClient));
    }

    *fetchFilesMeta() {
        var validTypes = Object.keys(GuFile.types);
        var fileList = yield denodeify(drive.files.list)({ auth: jwtClient });
        if (fileList.kind !== 'drive#fileList')
            throw new Error('Unexpected response ( fileList.kind !== \'drive#fileList\' )');
        return fileList.items
          .filter(file => validTypes.indexOf(file.mimeType) !== -1 )
    }

    *update() {
        var db = yield this.getDb();
        var fileMetas = yield this.fetchFilesMeta();
        var tokens = yield this.getTokens();
        for (let fileMeta of fileMetas) {
            let fileJSON = db.files[fileMeta.id] || {metaData: fileMeta};
            let guFile = GuFile.deserialize(fileJSON);
            if (guFile) {
                yield guFile.update(fileMeta, tokens);
                db.files[guFile.id] = guFile.serialize();
                yield this.saveDb(db);
            }
        }
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
        if (!FileClass) console.log(`mimeType ${json.metaData.mimeType} not recognized`);
        else return new FileClass(json);
    }

    serialize() {
        return {
            metaData: this.metaData,
            rawBody: this.rawBody,
            lastUploadTest: this.lastUploadTest,
            lastUploadProd: this.lastUploadProd,
            domainPermissions: this.domainPermissions
        };
    }

    *fetchDomainPermissions() {
        if (gu.config.requireDomainPermissions) {
            var listPermissions = denodeify(drive.permissions.list);
            var perms = yield listPermissions({auth: jwtClient, fileId: this.id});
            var domainPermission = perms.items.find(i => i.name === gu.config.requireDomainPermissions)
            if (domainPermission) return domainPermission.role;
            else if(perms.items.find(i => i.emailAddress === key.client_email)) {
                return 'none';
            } else return 'unknown';
        } else return 'disabled';
    }

    uploadToS3(prod=false) {
        var params = {
            Bucket: gu.config.s3bucket,
            Key: prod ? this.pathProd : this.pathTest,
            Body: this.stringBody,
            ACL: 'public-read',
            ContentType: 'application/json',
            CacheControl: prod ? 'max-age=30' : 'max-age=5'
        }
        var promise = gu.s3.putObject(params);
        promise.then(_ =>
            this[prod ? 'lastUploadProd' : 'lastUploadTest'] = this.metaData.modifiedDate);
        return promise;
    }
}
export class DocsFile extends GuFile {

    get archieJSON() { return archieml.load(this.rawBody) }

    *update(newMetaData, tokens) {
        var needsUpdating = this.rawBody === '' ||
                            this.metaData.modifiedDate !== newMetaData.modifiedDate;
        console.log(needsUpdating ? '' : 'not', `updating ${this.title}`)
        this.metaData = newMetaData;
        if (needsUpdating) {
            this.rawBody = yield this.fetchFileBody(tokens);
            this.domainPermissions = yield this.fetchDomainPermissions();
            return this.uploadToS3(false);
        }
        return new Promise(resolve => resolve())
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

    *getSheetCsvGid(tokens) {
        var embedHTML = yield rp({
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

    *getSheetAsJson(gid, tokens) {
        var baseUrl = this.metaData.exportLinks['text/csv'],
            json,
            csv = yield rp({
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

    *update(newMetaData, tokens) {
        var needsUpdating = this.rawBody === '' ||
                            this.metaData.modifiedDate !== newMetaData.modifiedDate;
        console.log(needsUpdating ? '' : 'not', `updating ${this.title}`)
        this.metaData = newMetaData;
        if (needsUpdating) {
            var sheetUrls = yield this.getSheetCsvGid(tokens);

            var sheetJsons = yield sheetUrls.map(url => this.getSheetAsJson(url, tokens));

            this.rawBody = {};
            this.rawBody['sheets'] = _.zipObject(this.sheetNames, sheetJsons)

            this.domainPermissions = yield this.fetchDomainPermissions();
            return this.uploadToS3(false);
        }
        return new Promise(resolve => resolve())
    }
}
