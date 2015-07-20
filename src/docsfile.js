import gu from 'koa-gu'
import rp from 'request-promise'
import archieml from 'archieml'

export class DocsFile {
    constructor({metaData, lastUploadTest = null, lastUploadProd = null, rawBody = ''}) {
        this.metaData = metaData;
        this.lastUploadTest = lastUploadTest
        this.lastUploadProd = lastUploadProd
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

    get archieJSON() { return archieml.load(this.rawBody) }

    *update(newMetaData, tokens) {
        var needsUpdating = this.rawBody === '' ||
                            this.metaData.modifiedDate !== newMetaData.modifiedDate;
        console.log(needsUpdating ? '' : 'not', `updating ${this.title}`)
        this.metaData = newMetaData;
        if (needsUpdating) {
            this.rawBody = yield this.fetchFileBody(tokens);
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

    uploadToS3(prod=false) {
        var params = {
            Bucket: gu.config.s3bucket,
            Key: prod ? this.pathProd : this.pathTest,
            Body: JSON.stringify(this.archieJSON),
            ACL: 'public-read',
            ContentType: 'application/json',
            CacheControl: prod ? 'max-age=30' : 'max-age=5'
        }
        var promise = gu.s3.putObject(params);
        promise.then(_ =>
            this[prod ? 'lastUploadProd' : 'lastUploadTest'] = this.metaData.modifiedDate);
        return promise;
    }

    serialize() {
        return {
            metaData: this.metaData,
            rawBody: this.rawBody,
            lastUploadTest: this.lastUploadTest,
            lastUploadProd: this.lastUploadProd
        };
    }
}
