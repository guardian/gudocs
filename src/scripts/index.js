const google = require('googleapis')
const drive = google.drive('v2')
const rp = require('request-promise')
const denodeify = require('denodeify')
const archieml = require('archieml')
const _ = require('lodash')
const db = require(':db')
const config = require(':config').scripts.docs2archieml
const s3 = require(':s3')

exports.run = function*() {
    let docs2archieml = new Docs2archieml(config)
    yield docs2archieml.run();
}

class Docs2archieml {
    constructor(opts) {
        this.opts = opts;
        this.dbKey = 'docs2archieml';
        this.jwtClient = new google.auth.JWT(
            this.opts.auth_email,
            this.opts.auth_key,
            null,
            ['https://www.googleapis.com/auth/drive']
        );
    }
    createNewFileObj(fileMeta) {
        var keys = [ 'urlDoc', 'lastChecked', 'rawBody', 'lastFetched',
            'lastModifiedTest', 'lastModifiedProd', 'title', 'lastModified', 'lastModifyingUserName',
            'urlDoc', 'pathTest', 'urlTest', 'pathProd', 'urlProd'];

        var newFileObj = { id: fileMeta.id };
        keys.forEach(k => newFileObj[k] = null);
        return newFileObj;
    }
    getFileBody(fileMeta) {
      var downloadUrl = fileMeta.exportLinks['text/plain'];
      return rp({
          uri: downloadUrl,
          headers: {
              'Authorization': this.tokens.token_type + ' ' + this.tokens.access_token
          }
      });
    }
    uploadToTestS3(fileObj) {
        var params = {
            Bucket: this.opts.s3bucket,
            Key: fileObj.pathTest,
            Body: JSON.stringify(archieml.load(fileObj.rawBody)),
            ACL: 'public-read',
            ContentType: 'application/json',
            CacheControl: 'max-age=5'
        }
        return config.no_upload ?
          new Promise(resolve => { console.log(`test upload ${params.Key}`); resolve(); }) :
          s3.putObject(params);
    }
    *loadDb() {
      this.db = (yield db.getObj(this.dbKey)) || { files: {} };
      console.log(`${Object.keys(this.db.files).length} entries in db`)
    }
    *saveFileObj(fileObj) {
      this.db.lastSaved = new Date();
      this.db.files[fileObj.id] = fileObj;
      yield db.setObj(this.dbKey, this.db);
    }

    *run() {
        this.tokens = yield this.jwtClient.authorize.bind(this.jwtClient);
        yield this.loadDb();

        var fileMetas = yield this.fetchFilesMeta();
        for (let fileMeta of fileMetas) {

            // get or create file object
            let fileObj = this.db.files[fileMeta.id] || this.createNewFileObj(fileMeta);

            // update values
            fileObj.title = fileMeta.title
            fileObj.lastModified = fileMeta.modifiedDate
            fileObj.lastModifyingUserName = fileMeta.lastModifyingUserName
            fileObj.urlDoc = fileMeta.alternateLink;

            fileObj.pathTest = `${this.opts.testFolder}/${fileObj.id}.json`;
            fileObj.urlTest = `${this.opts.s3domain}/${fileObj.pathTest}`;
            fileObj.pathProd = `${this.opts.prodFolder}/${fileObj.id}.json`;
            fileObj.urlProd = `${this.opts.s3domain}/${fileObj.pathProd}`;

            // fetch new file body if it has been modified since last time
            if (!fileObj.lastFetched || fileObj.lastFetched !== fileObj.lastModified) {
              fileObj.rawBody = yield this.getFileBody(fileMeta);
              fileObj.lastFetched = fileObj.lastModified;
            }

            // upload archie to test if it has been modified since last time
            if (!fileObj.lastModifiedTest || fileObj.lastModifiedTest !== fileObj.lastFetched) {
                yield this.uploadToTestS3(fileObj);
                fileObj.lastModifiedTest = fileObj.lastFetched;
            }

            // note time and save object
            fileObj.lastChecked = new Date()
            yield this.saveFileObj(fileObj);
        }
    }

    *fetchFilesMeta() {
        let fileList = yield denodeify(drive.files.list)({ auth: this.jwtClient });
        if (fileList.kind !== 'drive#fileList')
            throw new Error('Unexpected response ( fileList.kind !== \'drive#fileList\' )');
        console.log(fileList.items.filter(f => f.mimeType === 'application/vnd.google-apps.spreadsheet'));
        return fileList.items
          .filter(file => file.mimeType === 'application/vnd.google-apps.document')
    }
}
