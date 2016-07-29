import gu from 'koa-gu'
import archieml from 'archieml'
import { _ } from 'lodash'
import Baby from 'babyparse'
import drive from './drive'
import key from '../key.json'
import { delay } from './util'
import createLimiter from './limiter'

var s3limiter = createLimiter('s3', 50);

class GuFile {
    constructor({metaData, lastUploadTest = null, lastUploadProd = null, domainPermissions = 'unknown', properties = {}}) {
        this.metaData = metaData;
        this.lastUploadTest = lastUploadTest;
        this.lastUploadProd = lastUploadProd;
        this.domainPermissions = domainPermissions;
        this.properties = properties;
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
            domainPermissions: this.domainPermissions,
            properties: this.properties
        });
    }

    async fetchDomainPermissions() {
        if (gu.config.requireDomainPermissions) {
            var perms = await drive.fetchFilePermissions(this.id);
            var domainPermission = perms.items.find(i => i.name === gu.config.requireDomainPermissions)
            if (domainPermission) {
                return domainPermission.role;
            } else if(perms.items.find(i => i.emailAddress === key.client_email)) {
                return 'none';
            } else {
                return 'unknown';
            }
        } else {
            return 'disabled';
        }
    }

    async update(publish) {
        gu.log.info(`Updating ${this.id} ${this.title} (${this.metaData.mimeType})`);

        var body = await this.fetchFileJSON();
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
        var promise = s3limiter.normal(gu.s3.putObject, params);
        promise.then(_ =>
            this[prod ? 'lastUploadProd' : 'lastUploadTest'] = this.metaData.modifiedDate);
        promise.then(_ => gu.log.info(`Uploaded ${this.title} to ${uploadPath}`))
        return promise;
    }
}

class DocsFile extends GuFile {
    async fetchFileJSON() {
      var rawBody = (await drive.request(this.metaData.exportLinks['text/plain'])).replace(/http:\/\//g, 'https://');
      return archieml.load(rawBody);
    }
}

// Some magic numbers that seem to make Google happy
const delayInitial = 500;
const delayExp = 1.6;
const delayCutoff = 8; // After this many sheets, just wait delayMax
const delayMax = 20000;

class SheetsFile extends GuFile {
    async fetchFileJSON() {
        var spreadsheet = await drive.fetchSpreadsheet(this.id);
        var ms = 0;
        var delays = spreadsheet.sheets.map((sheet, n) => {
            ms += n > delayCutoff ? delayMax : delayInitial * Math.pow(delayExp, n);
            return delay(ms, () => this.fetchSheetJSON(sheet));
        });
        try {
            var sheetJSONs = await Promise.all(delays.map(d => d.promise));
            this.properties.isTable = sheetJSONs.findIndex(sheetJSON => sheetJSON.tableDataSheet !== undefined) > -1;

            return {'sheets': Object.assign({}, ...sheetJSONs)};
        } catch (err) {
            delays.forEach(d => d.cancel());
            throw err;
        }
    }

    async fetchSheetJSON(sheet) {
        var baseURL = this.metaData.exportLinks['text/csv'];
        var csv = (await drive.request(`${baseURL}&gid=${sheet.properties.sheetId}`)).replace(/http:\/\//g, 'https://');
        var json = Baby.parse(csv, {'header': sheet.properties.title !== 'tableDataSheet'}).data;
        return {[sheet.properties.title]: json};
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
