import gu from 'koa-gu'
import denodeify from 'denodeify'
import google from 'googleapis'
import rp from 'request-promise'
import createLimiter from './limiter'
import sak from './service-account-key'

var drive = google.drive('v2');
var sheets = google.sheets('v4');

const listPermissions = denodeify(drive.permissions.list);
const listChanges = denodeify(drive.changes.list);
const getSpreadsheet = denodeify(sheets.spreadsheets.get);

var limiter = createLimiter('drive', 100);

async function getGoogleAuth() {
    const key = await sak.getServiceAccountKey();
    const auth = new google.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive']);
    return auth;
}

async function fetchAllChanges(auth, pageToken = undefined) {
    var options = Object.assign({auth, 'maxResults': 1000}, pageToken ? {pageToken} : {});
    var page = await limiter.high(listChanges, options);

    var largestChangeId, items;
    if (page.nextPageToken) {
        let nextPage = await fetchAllChanges(auth, page.nextPageToken);
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

    async function _req(auth, uri) {
        gu.log.info('Requesting', uri);
        const authorize = denodeify(auth.authorize.bind(auth));
        if (!token) token = await authorize();

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

    return function req(auth, uri) {
        return rlimiter.normal(_req, auth, uri);
    };
})();

export default {
    request,

    fetchAllChanges,

    getGoogleAuth,

    fetchRecentChanges(auth, startChangeId) {
        return limiter.high(listChanges, {auth, startChangeId, 'maxResults': 25});
    },

    fetchFilePermissions(auth, fileId) {
        return limiter.high(listPermissions, {auth, fileId});
    },

    fetchSpreadsheet(auth, spreadsheetId) {
        return limiter.normal(getSpreadsheet, {auth, spreadsheetId});
    }
}
