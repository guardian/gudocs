import google from 'googleapis'
import denodeify from 'denodeify'
import _ from 'lodash'
import path from 'path'
import gu from 'koa-gu'
import co from 'co'
import fs from 'fs'
import {DocsFile} from './docsfile'
var drive = google.drive('v2')
var key = require('../key.json');

class Docs2archieml {

    constructor(opts) {
        this.opts = opts;
        this.jwtClient = new google.auth.JWT(
            key.client_email,
            null,
            key.private_key,
            ['https://www.googleapis.com/auth/drive']
        );
    }

    *loadDb() {
      this.db = (yield gu.db.getObj(gu.config.dbkey)) || { files: {} };
      console.log(`${Object.keys(this.db.files).length} entries in db`)
    }

    *saveFileObj(fileObj) {
      this.db.lastSaved = new Date();
      this.db.files[fileObj.id] = fileObj.serialize();
      yield gu.db.setObj(gu.config.dbkey, this.db);
    }

    *fetchFilesMeta() {
        var fileList = yield denodeify(drive.files.list)({ auth: this.jwtClient });
        if (fileList.kind !== 'drive#fileList')
            throw new Error('Unexpected response ( fileList.kind !== \'drive#fileList\' )');
        return fileList.items
          .filter(file => file.mimeType === 'application/vnd.google-apps.document')
    }

    *run() {
        this.tokens = yield this.jwtClient.authorize.bind(this.jwtClient);
        yield this.loadDb();

        var fileMetas = yield this.fetchFilesMeta();
        for (let fileMeta of fileMetas) {
            let fileJSON = this.db.files[fileMeta.id] || {metaData: fileMeta};
            let docsFile = new DocsFile(fileJSON);
            yield docsFile.update(fileMeta, this.tokens);
            yield this.saveFileObj(docsFile);
        }
    }
}

co(function*() {
    gu.init(false);
    var docs2archieml = new Docs2archieml(gu.config)
    yield docs2archieml.run();
}).catch(err => {
    console.log(err.stack); gu.db.quit();
}).then(_ => gu.db.quit())
