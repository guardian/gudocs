import google from 'googleapis'
import denodeify from 'denodeify'
import _ from 'lodash'
import path from 'path'
import gu from 'koa-gu'
import co from 'co'
import fs from 'fs'
import { FileManager } from './docsfile'
var key = require('../key.json');

class Gudocs {
    constructor(opts) {
        this.opts = opts;
    }

    *run() {
        var jwtClient = new google.auth.JWT(
            key.client_email,
            null,
            key.private_key,
            ['https://www.googleapis.com/auth/drive']
        );
        var fileManager = new FileManager({jwtClient});
        yield fileManager.update();
    }
}

co(function*() {
    gu.init(false);
    var docs2archieml = new Gudocs(gu.config)
    yield docs2archieml.run();
}).catch(err => {
    console.log(err.stack); gu.db.quit();
}).then(_ => gu.db.quit())
