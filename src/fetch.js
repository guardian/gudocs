import gu from 'koa-gu'
import co from 'co'
import fileManager from './fileManager'
import program from 'commander'

program
  .option('-a, --all', 'fetch all changes', false)
  .option('--id [id]', 'fetch specific id', s => s.split(','))
  .parse(process.argv);

function *fetch() {
    gu.init({www:false});
    yield fileManager.update({fetchAll: !!program.all, fileIds: program.id});
}

co(fetch)
    .catch(err => gu.log.error(err.stack))
    .then(_ => gu.db.quit());
