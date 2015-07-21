import _ from 'lodash'
import archieml from 'archieml'
import moment from 'moment'
import { DocsFile } from './docsfile'
import gu from 'koa-gu'

exports.index = function *(){
    const docs2archieml = (yield gu.db.getObj(gu.config.dbkey)) || { files: {} };
    const files = _(docs2archieml.files).values()
        .sort(function(a,b) { return moment(b.lastModified) - moment(a.lastModified); })
        .map(v => new DocsFile(v))
        .valueOf()
    this.body = gu.tmpl('./templates/index.html', { docs2archieml: docs2archieml, files: files });
};

exports.publish = function *() {
    const docs2archieml = (yield gu.db.getObj(gu.config.dbkey)) || { files: {} };
    var docId = this.request.body.id;
    var fileJSON = docs2archieml.files[docId];
    if (fileJSON) {
        var docsFile = new DocsFile(fileJSON);
        yield docsFile.uploadToS3(true);
        docs2archieml.files[docId] = docsFile.serialize();
        gu.db.setObj(gu.config.dbkey, docs2archieml);
        this.redirect(gu.config.base_url);
    } else {
        this.body = "File ID not found...???"
    }
}
