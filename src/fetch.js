import gu from 'koa-gu'
import co from 'co'
import { FileManager } from './docsfile'
import program from 'commander'

program
  .option('-a, --all', 'fetch all changes', false)
  .parse(process.argv);

class Gudocs {
    constructor(opts) {
        this.opts = opts;
    }

    *run() {
        var fileManager = new FileManager();
        yield fileManager.update({ignoreStartId: !!program.all});
    }
}

co(function*() {
    gu.init(false);
    var docs2archieml = new Gudocs(gu.config)
    yield docs2archieml.run();
}).catch(err => {
    gu.log.error(err.stack); gu.db.quit();
}).then(_ => gu.db.quit())
