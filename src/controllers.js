import gu from '@guardian/koa-gu'
import fs from 'fs'
import path from 'path'
import fileManager from './fileManager'

const key = require('../key.json');
const cssPath = path.resolve(__dirname, '../build/main.css');

exports.index = function *(){
    const page = parseInt(this.request.query.page) || 0;
    const size = parseInt(this.request.query.size) || 50;
    const dev = this.request.query.dev !== undefined;

    this.body = gu.tmpl('./templates/index.html', {
        page, size, dev,
        docs2archieml: yield fileManager.getStateDb(),
        files: yield fileManager.getAllGuFiles(page * size, (page + 1) * size - 1),
        email: key.client_email,
        css: fs.readFileSync(cssPath, 'utf8')
    });
};

exports.publish = function *() {
    const fileId = this.request.body.id;
    const prod = !this.request.query.test;
    if (fileId) {
        yield fileManager.update({'fileIds': [fileId], prod});
        this.redirect(this.headers.referer);
    } else {
        this.body = "File ID not found...???"
    }
}
