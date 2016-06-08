import AWS from 'aws-sdk'
import denodeify from 'denodeify'
import config from '../gu.json' // hack because koa-gu doesn't load config until init
import gu from 'koa-gu'

export function delay(ms, then) {
    var interval;
    var promise = new Promise(resolve => interval = setTimeout(resolve, ms)).then(then);
    return {
        cancel() { clearTimeout(interval); },
        promise
    };
}

var credentials = new AWS.SharedIniFileCredentials(config.aws_profile);
AWS.config.region = 'eu-west-1';
AWS.config.credentials = credentials;
var sns = new AWS.SNS({'params': {'TopicArn': config.snsErrors}});
var snsPublish = denodeify(sns.publish.bind(sns));

export function notify(subject, message) {
    return snsPublish({'Subject': subject, 'Message': message}).catch(err => {
        gu.log.error('Failed to send notification', err);
    });
}
