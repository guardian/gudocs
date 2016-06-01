import { jwtClient } from './auth.js'
import denodeify from 'denodeify'
import google from 'googleapis'

var drive = google.drive('v2');

const listPermissions = denodeify(drive.permissions.list);
const jwtAuthorize = denodeify(jwtClient.authorize.bind(jwtClient));

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
        return new Promise(resolve => {
            var opts = {auth:jwtClient, startChangeId: startChangeId, maxResults: 25};
            drive.changes.list(opts, (err, resp) => {
                if (err) { console.error(err); process.exit(1); }
                resolve(resp);
            });
        })
    },

    getTokens() {
        return jwtAuthorize();
    },

    listPermissions(fileId) {
        return listPermissions({auth: jwtClient, fileId});
    }
}
