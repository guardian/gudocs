import _ from 'lodash'
import archieml from 'archieml'
import moment from 'moment'
import { FileManager } from './docsfile'
import gu from 'koa-gu'
import fs from 'fs'
import path from 'path'
var key = require('../key.json')
var cssPath = path.resolve(__dirname, '../build/main.css');

exports.index = function *(){
    this.body = gu.tmpl('./templates/index.html', {
        docs2archieml: yield FileManager.getStateDb(),
        files: yield FileManager.getAllGuFiles(),
        email: key.client_email,
        css: fs.readFileSync(cssPath, 'utf8')
    });
};

exports.publish = function *() {
    const docs2archieml = (yield gu.db.getObj(gu.config.dbkey)) || { files: {} };
    var docId = this.request.body.id;
    var fileJSON = docs2archieml.files[docId];
    if (fileJSON) {
        var guFile = GuFile.deserialize(fileJSON);
        yield guFile.uploadToS3(true);
        docs2archieml.files[docId] = guFile.serialize();
        gu.db.setObj(gu.config.dbkey, docs2archieml);
        this.redirect(this.headers.referer);
    } else {
        this.body = "File ID not found...???"
    }
}
