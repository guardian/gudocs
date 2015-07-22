import _ from 'lodash'
import archieml from 'archieml'
import moment from 'moment'
import { GuFile } from './docsfile'
import gu from 'koa-gu'
var key = require('../key.json');

exports.index = function *(){
    const docs2archieml = (yield gu.db.getObj(gu.config.dbkey)) || { files: {} };
    const files = _(docs2archieml.files).values()
        .sort(function(a,b) { return moment(b.metaData.modifiedDate) - moment(a.metaData.modifiedDate); })
        .map(v => GuFile.deserialize(v))
        .valueOf()
    this.body = gu.tmpl('./templates/index.html', { docs2archieml: docs2archieml, files: files, email: key.client_email });
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
