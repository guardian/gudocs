import gu from '@guardian/koa-gu'
import fs from 'fs'
import rp from 'request-promise'
import createLimiter from './limiter'

const keysFile = fs.readFileSync('key.json', 'utf8')
const keys = JSON.parse(keysFile);

const { google } = require('googleapis');
const authClient = google.auth.fromJSON(keys);
authClient.scopes = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'];
google.options({
    auth: authClient,
    timeout: 5000,
})

const driveService = google.drive('v2');
const sheetsService = google.sheets('v4');

async function fetchAllChanges(pageToken = 1, items = [], largestChangeId = 0) {
    const page = await driveService.changes.list({pageToken, maxResults: 1000});

    if (page.data.items.length > 0) {
        return await fetchAllChanges(
            page.data.newStartPageToken,
            items.concat(page.data.items),
            Math.max(largestChangeId, page.data.largestChangeId),
        );
    }

    return {data: {items, largestChangeId}};
}

// TODO: deprecate in favour of googleapis
const request = (function () {
    let token;
    const rlimiter = createLimiter('request', 400);

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
        return await driveService.changes.list({pageToken: startChangeId, maxResults: 25});
    },

    async fetchFilePermissions(fileId) {
        return await driveService.permissions.list({fileId});
    },

    async fetchSpreadsheet(spreadsheetId) {
        return await sheetsService.spreadsheets.get({spreadsheetId});
    }
}