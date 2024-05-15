import gu from '@guardian/koa-gu'
import denodeify from 'denodeify'
import google from 'googleapis'
import rp from 'request-promise'
import key from '../key.json'
import createLimiter from './limiter'

var drive = google.drive('v2');
var sheets = google.sheets('v4');

var auth = new google.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive']);

var limiter = createLimiter('drive', 100);

const authorize = denodeify(auth.authorize.bind(auth));
const listPermissions = denodeify(drive.permissions.list);
const listChanges = denodeify(drive.changes.list);
const getSpreadsheet = denodeify(sheets.spreadsheets.get);

async function fetchAllChanges(pageToken = undefined) {
    var options = Object.assign({auth, 'maxResults': 1000}, pageToken ? {pageToken} : {});
    var page = await limiter.high(listChanges, options);

    var largestChangeId, items;
    if (page.nextPageToken) {
        let nextPage = await fetchAllChanges(page.nextPageToken);
        largestChangeId = Math.max(page.largestChangeId, nextPage.largestChangeId);
        items = page.items.concat(nextPage.items);
    } else {
        largestChangeId = page.largestChangeId;
        items = page.items;
    }

    return {items, largestChangeId};
}

// TODO: deprecate in favour of googleapis
var request = (function() {
    var token;
    var rlimiter = createLimiter('request', 400);

    async function _req(uri, maxRetries) {
        gu.log.info('Requesting', uri);
        if (!token) token = await authorize();

        try {
            return await rp({uri, 'headers': {'Authorization': `${token.token_type} ${token.access_token}`}});
        } catch (err) {
            if (err.statusCode === 401 && maxRetries > 0) {
                gu.log.info('Authorization token expired');
                token = undefined;
                return await req(uri, maxRetries - 1);
            }

            throw err;
        }
    }

    function req(uri, maxRetries = 2) {
        return rlimiter.normal(_req, uri, maxRetries);
    };

    return req
})();

export default {
    request,

    fetchAllChanges,

    fetchRecentChanges(startChangeId) {
        return limiter.high(listChanges, {auth, startChangeId, 'maxResults': 25});
    },

    fetchFilePermissions(fileId) {
        return limiter.high(listPermissions, {auth, fileId});
    },

    fetchSpreadsheet(spreadsheetId) {
        return limiter.normal(getSpreadsheet, {auth, spreadsheetId});
    }
}
