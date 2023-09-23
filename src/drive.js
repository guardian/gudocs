import gu from '@guardian/koa-gu'
import fs from 'fs'
import rp from 'request-promise'
import createLimiter from './limiter'

const { google } = require('googleapis');

const keysFile = fs.readFileSync('key.json', 'utf8')
const keys = JSON.parse(keysFile);

const authClient = google.auth.fromJSON(keys);
authClient.scopes = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'];

google.options({
    auth: authClient,
    timeout: 5000,
})

const driveService = google.drive('v2');
const sheetsService = google.sheets('v4');

async function fetchAllChanges(pageToken = 1) {
    return await driveService.changes.list({pageToken: 1, maxResults: 1000});
}

// TODO: deprecate in favour of googleapis
var request = (function() {
    var token;
    var rlimiter = createLimiter('request', 400);

    async function _req(uri) {
        gu.log.info('Requesting', uri);
        if (!token) token = await authClient.getAccessToken();

        try {
            return await rp({uri, 'headers': {'Authorization': `${token.token_type} ${token.access_token}`}});
        } catch (err) {
            if (err.statusCode === 401) {
                gu.log.info('Authorization token expired');
                token = undefined;
                return await req(uri);
            }

            throw err;
        }
    }

    return function req(uri) {
        return rlimiter.normal(_req, uri);
    };
})();

export default {
    request,

    fetchAllChanges,

    async fetchRecentChanges(startChangeId) {
        return await driveService.changes.list( {pageToken: startChangeId, maxResults: 25});
    },

    async fetchFilePermissions(fileId) {
        return await driveService.permissions.list({fileId});
    },

    async fetchSpreadsheet(spreadsheetId) {
        return await sheetsService.spreadsheets.get({spreadsheetId});
    }
}
