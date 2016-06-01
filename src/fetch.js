import gu from 'koa-gu'
import co from 'co'
import FileManager from './fileManager'
import program from 'commander'

program
  .option('-a, --all', 'fetch all changes', false)
  .option('--id [id]', 'fetch specific id')
  .parse(process.argv);

class Gudocs {
    constructor(opts) {
        this.opts = opts;
    }

    *run() {
        yield FileManager.update({fetchAll: !!program.all, fileId: program.id});
    }
}

co(function*() {
    gu.init({www:false});
    var docs2archieml = new Gudocs(gu.config)
    yield docs2archieml.run();
}).catch(err => {
    gu.log.error(err.stack); gu.db.quit();
}).then(_ => gu.db.quit())
