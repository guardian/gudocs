import gu from 'koa-gu'
import denodeify from 'denodeify'
import google from 'googleapis'
import rp from 'request-promise'
import key from '../key.json'
import Bottleneck from 'bottleneck'

var drive = google.drive('v2');
var sheets = google.sheets('v4');

var auth = new google.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive']);

var limiter = new Bottleneck(1, 100);

const authorize = denodeify(auth.authorize.bind(auth));
const listPermissions = denodeify(drive.permissions.list);
const listChanges = denodeify(drive.changes.list);
const getSpreadsheet = denodeify(sheets.spreadsheets.get);

async function fetchAllChanges(pageToken = undefined) {
    var options = Object.assign({auth, 'maxResults': 1000}, pageToken ? {pageToken} : {});
    var page = await limiter.schedule(listChanges, options);

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
    var rlimiter = new Bottleneck(1, 400);

    async function _req(uri) {
        gu.log.info('Requesting', uri);
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

    return function req(uri) {
        return rlimiter.schedule(_req, uri);
    };
})();

export default {
    request,

    fetchAllChanges,

    fetchRecentChanges(startChangeId) {
        return limiter.schedule(listChanges, {auth, startChangeId, 'maxResults': 25});
    },

    fetchFilePermissions(fileId) {
        return limiter.schedule(listPermissions, {auth, fileId});
    },

    fetchSpreadsheet(spreadsheetId) {
        return limiter.schedule(getSpreadsheet, {auth, spreadsheetId});
    }
}
