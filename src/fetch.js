import gu from 'koa-gu'
import co from 'co'
import { FileManager } from './docsfile'

class Gudocs {
    constructor(opts) {
        this.opts = opts;
    }

    *run() {
        var fileManager = new FileManager();
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
