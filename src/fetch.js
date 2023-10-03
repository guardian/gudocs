import gu from '@guardian/koa-gu'
import co from 'co'
import fileManager from './fileManager'
import program from 'commander'
import AWS from 'aws-sdk'




AWS.config.region = 'eu-west-1';

const run = async () => {
  // setup aws credentials
  await gu.init({www:false});

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
}

run();
