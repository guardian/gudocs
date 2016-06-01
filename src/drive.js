import { jwtClient } from './auth.js'
import denodeify from 'denodeify'
import google from 'googleapis'

var drive = google.drive('v2');
var sheets = google.sheets('v4');

const jwtAuthorize = denodeify(jwtClient.authorize.bind(jwtClient));
const listPermissions = denodeify(drive.permissions.list);
const listChanges = denodeify(drive.changes.list);

async function fetchAllChanges(pageToken = undefined) {
    var options = Object.assign({'auth': jwtClient, 'maxResults': 1000}, pageToken ? {pageToken} : {});
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

export default {
    fetchAllChanges,

    fetchRecentChanges(startChangeId) {
        return listChanges({'auth': jwtClient, 'maxResults': 25, startChangeId});
    },

    fetchFilePermissions(fileId) {
        return listPermissions({'auth': jwtClient, fileId});
    },

    // TODO: deprecate in favour of googleapis
    getTokens() {
        return jwtAuthorize();
    }
}
