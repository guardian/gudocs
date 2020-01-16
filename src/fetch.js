import gu from 'koa-gu'
import co from 'co'
import fileManager from './fileManager'
import program from 'commander'
import AWS from 'aws-sdk'

// setup aws credentials
gu.init({www:false});
var credentials = new AWS.SharedIniFileCredentials(gu.config.aws_profile);
AWS.config.region = 'eu-west-1';
AWS.config.credentials = credentials;

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
