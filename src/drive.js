import { jwtClient } from './auth.js'
import denodeify from 'denodeify'
import google from 'googleapis'

var drive = google.drive('v2');

const jwtAuthorize = denodeify(jwtClient.authorize.bind(jwtClient));
const listPermissions = denodeify(drive.permissions.list);
const listChanges = denodeify(drive.changes.list);

export default {
    fetchAllChanges() {
        let requestSize = 1000;
        return new Promise(resolve => {
            var retrievePageOfChanges = function(requestOpts, items, largestChangeId) {
                drive.changes.list(requestOpts, (err, resp) => {
                    if (err) { console.error(err); process.exit(1); }
                    items = items.concat(resp.items);
                    largestChangeId = resp.largestChangeId ? Math.max(resp.largestChangeId, largestChangeId) : largestChangeId;
                    var nextPageToken = resp.nextPageToken;
                    if (nextPageToken) {
                        retrievePageOfChanges(
                            {auth: jwtClient, maxResults: requestSize, pageToken: nextPageToken},
                            items, largestChangeId);
                    } else resolve({items: items, largestChangeId: largestChangeId});
                })
            }
            retrievePageOfChanges({auth:jwtClient, maxResults: requestSize}, [], 0);
        });
    },

    fetchRecentChanges(startChangeId) {
        return listChanges({auth: jwtClient, maxResults: 25, startChangeId});
    },

    fetchFilePermissions(fileId) {
        return listPermissions({auth: jwtClient, fileId});
    },

    // TODO: deprecate in favour of googleapis
    getTokens() {
        return jwtAuthorize();
    }
}
