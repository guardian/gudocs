import gu from 'koa-gu'
import co from 'co'
import FileManager from './fileManager'
import program from 'commander'

program
  .option('-a, --all', 'fetch all changes', false)
  .option('--id [id]', 'fetch specific id')
  .parse(process.argv);

function *fetch() {
    gu.init({www:false});
    yield FileManager.update({fetchAll: !!program.all, fileId: program.id});
}

co(fetch)
    .catch(err => gu.log.error(err.stack))
    .then(_ => gu.db.quit());
