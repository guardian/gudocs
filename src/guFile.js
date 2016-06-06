import gu from 'koa-gu'
import { _ } from 'lodash'
import drive from './drive'
import key from '../key.json'
import archieml from 'archieml'
import Baby from 'babyparse'
import XLSX from 'xlsx'

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
        gu.log.info(`Updating ${this.title} (${this.metaData.mimeType})`);

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
        var promise = gu.s3.putObject(params);
        promise.then(_ =>
            this[prod ? 'lastUploadProd' : 'lastUploadTest'] = this.metaData.modifiedDate);
        promise.then(_ => gu.log.info(`Uploaded ${this.title} to ${uploadPath}`))
        return promise;
    }
}

class DocsFile extends GuFile {
    async fetchFileJSON() {
      var rawBody = await drive.request(this.metaData.exportLinks['text/plain']);
      return archieml.load(rawBody);
    }
}

class SheetsFile extends GuFile {
    async fetchFileJSON() {
        // TODO: deprecate old parser
        if (false) {
            return this.old_fetchFileJSON();
        }

        var exportURL = this.metaData.exportLinks['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        var xlsx = await drive.request(exportURL, {'encoding': null, 'gzip': true});
        var spreadsheet = XLSX.read(xlsx);
        var sheetJSONs = spreadsheet.SheetNames.map(sheetName => {
            var csv = XLSX.utils.sheet_to_csv(spreadsheet.Sheets[sheetName]).replace(/\n(,+\n)+$/, '');
            var json = Baby.parse(csv, {'header': sheetName !== 'tableDataSheet'}).data;
            return {[sheetName]: json};
        });
        return {'sheets': Object.assign({}, ...sheetJSONs)};
    }

    async old_fetchFileJSON() {
        var spreadsheet = await drive.fetchSpreadsheet(this.id);
        var sheetJSONs = await Promise.all(spreadsheet.sheets.map(sheet => this.old_fetchSheetJSON(sheet)));
        return {'sheets': Object.assign({}, ...sheetJSONs)};
    }

    async old_fetchSheetJSON(sheet) {
        var baseURL = this.metaData.exportLinks['text/csv'];
        var csv = await drive.request(`${baseURL}&gid=${sheet.properties.sheetId}`);
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
