const { program } = require('commander');
const www = require('../src');

program
    .option('-H, --host <host>', 'specify the host [0.0.0.0]', '0.0.0.0')
    .option('-p, --port <port>', 'specify the port [4000]', '4001')
    .option('-b, --backlog <size>', 'specify the backlog size [511]', '511')
    .parse(process.argv);

www().then(app => {
  app.listen(program.opts().port, program.opts().host, ~~program.opts().backlog);
  console.log('Listening on %s:%s', program.opts().host, program.opts().port);
})