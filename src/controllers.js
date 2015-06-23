const gu = require('koa-gu')
const _ = require('lodash')
const archieml = require('archieml')
const moment = require('moment')

exports.index = function *(){
    const docs2archieml = (yield gu.db.getObj('docs2archieml')) || { files: {} };
    const files = _(docs2archieml.files).values()
        .sort(function(a,b) { return moment(b.lastModified) - moment(a.lastModified); })
        .valueOf()
    this.body = gu.tmpl('./templates/index.html', { docs2archieml: docs2archieml, files: files });
};

function* uploadToProdS3(fileObj) {
    var params = {
        Bucket: gu.config.s3bucket,
        Key: fileObj.pathProd,
        Body: JSON.stringify(archieml.load(fileObj.rawBody)),
        ACL: 'public-read',
        ContentType: 'application/json',
        CacheControl: 'max-age=30'
    }
    return gu.s3.putObject(params);
}

exports.publish = function *() {
    const docs2archieml = (yield gu.db.getObj('docs2archieml')) || { files: {} };
    var docId = this.request.body.id;
    var file = docs2archieml.files[docId];
    if (file) {
        yield uploadToProdS3(file);
        file.lastModifiedProd = file.lastModified;
        gu.db.setObj('docs2archieml', docs2archieml);
        this.redirect(gu.config.base_url);
    } else {
        this.body = "File ID not found...???"
    }
}
