import AWS from 'aws-sdk'
import gu from 'koa-gu'
gu.init({ www: false });

// TODO shared file creds is relevant only on local machine
const credentials = new AWS.SharedIniFileCredentials({ profile: gu.config.aws_profile });
AWS.config.credentials = credentials;
AWS.config.region = 'eu-west-1';

export function getSSMClient() {
    return new AWS.SSM();
}


