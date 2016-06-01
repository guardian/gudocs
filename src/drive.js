import denodeify from 'denodeify'
import google from 'googleapis'
import rp from 'request-promise'

var drive = google.drive('v2');
var sheets = google.sheets('v4');

var key = require('../key.json');
var auth = new google.auth.JWT(key.client_email, null, key.private_key, ['https://www.googleapis.com/auth/drive']);

const authorize = denodeify(auth.authorize.bind(auth));
const listPermissions = denodeify(drive.permissions.list);
const listChanges = denodeify(drive.changes.list);
const getSpreadsheet = denodeify(sheets.spreadsheets.get);

async function fetchAllChanges(pageToken = undefined) {
    var options = Object.assign({auth, 'maxResults': 1000}, pageToken ? {pageToken} : {});
    var page = await listChanges(options);

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
    return async function (uri) {
        if (!token) {
            token = await authorize();
            // refresh every 30 mins
            setTimeout(() => token = undefined, 30 * 60 * 1000);
        }
        return rp({uri, 'headers': {'Authorization': `${token.token_type} ${token.access_token}`}});
    };
})();

export default {
    request,

    fetchAllChanges,

    fetchRecentChanges(startChangeId) {
        return listChanges({auth, startChangeId, 'maxResults': 25});
    },

    fetchFilePermissions(fileId) {
        return listPermissions({auth, fileId});
    },

    fetchSpreadsheet(spreadsheetId) {
        return getSpreadsheet({auth, spreadsheetId});
    }
}
