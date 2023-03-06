import gu from 'koa-gu'
import co from 'co'
import fileManager from './fileManager'
import program from 'commander'
import AWS from 'aws-sdk'

// setup aws credentials
gu.init({www:false});
AWS.config.region = 'eu-west-1';

program
  .option('-a, --all', 'fetch all changes', false)
  .option('--id [id]', 'fetch specific id', s => s.split(','))
  .parse(process.argv);

function *fetch() {
    yield fileManager.update({fetchAll: !!program.all, fileIds: program.id});
}

co(fetch)
    .catch(err => gu.log.error(err.stack))
    .then(_ => gu.db.quit());
