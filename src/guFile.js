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

class GuFile {
    constructor({metaData, lastUploadTest = null, lastUploadProd = null, domainPermissions = 'unknown'}) {
        this.metaData = metaData;
        this.lastUploadTest = lastUploadTest
        this.lastUploadProd = lastUploadProd
        this.domainPermissions = domainPermissions
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

    serialize() {
        return JSON.stringify({
            metaData: this.metaData,
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

    async update(tokens, publish) {
        gu.log.info(`Updating ${this.title} (${this.metaData.mimeType})`);

        var body = await this.fetchFileJSON(tokens);
        this.domainPermissions = await this.fetchDomainPermissions();

        var p = this.uploadToS3(body, false);
        if (publish) return p.then(() => this.uploadToS3(body, true));
        return p;
    }

    uploadToS3(body, prod) {
        var uploadPath = prod ? this.pathProd : this.pathTest;
        var params = {
            Bucket: gu.config.s3bucket,
            Key: uploadPath,
            Body: JSON.stringify(body),
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

class DocsFile extends GuFile {
    async fetchFileJSON(tokens) {
      var rawBody = await rp({
          uri: this.metaData.exportLinks['text/plain'],
          headers: {
              'Authorization': tokens.token_type + ' ' + tokens.access_token
          }
      });
      return archieml.load(rawBody);
    }
}

class SheetsFile extends GuFile {
    async fetchFileJSON(tokens) {
        var sheetUrls = await this.getSheetCsvGid(tokens);
        var sheetJsons = await Promise.all(sheetUrls.map(url => this.getSheetAsJson(url, tokens)))
        return { sheets: _.zipObject(this.sheetNames, sheetJsons) };
    }

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
}

const types = {
    'application/vnd.google-apps.spreadsheet': SheetsFile,
    'application/vnd.google-apps.document': DocsFile
};

export function deserialize(json) {
    var FileClass = types[json.metaData.mimeType];
    if (!FileClass) gu.log.warn(`mimeType ${json.metaData.mimeType} not recognized`);
    else return new FileClass(json);
}
