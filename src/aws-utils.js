import AWS from 'aws-sdk'
import gu from 'koa-gu'
import createLimiter from './limiter'

gu.init({ www: false });
const sharedFileCreds = new AWS.SharedIniFileCredentials({ profile: gu.config.aws_profile });
AWS.config.region = 'eu-west-1';

export function getSSMClient() {
    // TODO shared file creds is relevant only on local machine
    AWS.config.credentials = sharedFileCreds;
    return new AWS.SSM();
}

export function getS3Limiter() {
    // TODO shared file creds is relevant only on local machine
    AWS.config.credentials = sharedFileCreds;
    return createLimiter('s3', 50);
}


