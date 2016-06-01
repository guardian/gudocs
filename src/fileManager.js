import gu from 'koa-gu'
import denodeify from 'denodeify'
import google from 'googleapis'
import { jwtClient } from './auth.js'
import { _ } from 'lodash'

import { deserialize } from './guFile'

var drive = google.drive('v2')

export default class FileManager {
    static async getStateDb() {
        var stateDbString = await gu.db.get(gu.config.dbkey);
        return stateDbString ? JSON.parse(stateDbString) :
                                { lastChangeId: 0, lastSaved: new Date('1900-01-01') }
    }

    static async saveStateDb(db) {
        db.lastSaved = new Date();
        return gu.db.set(gu.config.dbkey, JSON.stringify(db));
    }

    static async getGuFiles(ids) {
        var keys = ids.map(id => `${gu.config.dbkey}:${id}`)
        var strs = await gu.db.mget.call(gu.db, keys);
        var jsons = strs.map(JSON.parse);
        return jsons.map(json => json && deserialize(json));
    }

    static async getAllGuFiles(start = 0, end = -1) {
        var ids = await gu.db.zrevrange(`${gu.config.dbkey}:index`, start, end);
        return ids.length ? await FileManager.getGuFiles(ids) : [];
    }

    static async saveGuFiles(files) {
        var saveArgs = _.flatten( files.map(file => [`${gu.config.dbkey}:${file.id}`, file.serialize()]) )
        await gu.db.mset.call(gu.db, saveArgs);

        var indexArgs = _.flatten( files.map(file => [file.unixdate, file.id]) )
        indexArgs.unshift(`${gu.config.dbkey}:index`)
        await gu.db.zadd.call(gu.db, indexArgs);
    }

    static async getTokens() {
        var promiseFn = denodeify(jwtClient.authorize.bind(jwtClient))
        return await promiseFn();
    }

    static async fetchRecentChanges(startChangeId) {
        return new Promise(resolve => {
            var opts = {auth:jwtClient, startChangeId: startChangeId, maxResults: 25};
            drive.changes.list(opts, (err, resp) => {
                if (err) { console.error(err); process.exit(1); }
                resolve(resp);
            });
        })
    }

    static async fetchAllChanges() {
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
    }

    static async update({fetchAll = false, fileId = '', publish = false}) {
        var guFiles = [];
        if (fileId) {
            guFiles = await FileManager.getGuFiles([fileId]);
        } else {
            var db = await FileManager.getStateDb();
            var changeList;

            if (fetchAll) {
                changeList = await FileManager.fetchAllChanges();
                gu.log.info(`${changeList.items.length} changes. Largest ChangeId: ${changeList.largestChangeId}`)
            } else {
                var startChangeId = 1 + Number(db.lastChangeId);
                changeList = await FileManager.fetchRecentChanges(startChangeId);
                gu.log.info(`${changeList.items.length} new changes since ChangeId ${startChangeId}. Largest ChangeId: ${changeList.largestChangeId}`)
            }

            if (changeList.items.length > 0) {
                var changedFiles = changeList.items.map(change => change.file).filter(f => f)
                var ids = changedFiles.map(file => file.id);
                var existing = await FileManager.getGuFiles(ids);
                existing.forEach((guFile, i) => guFile && (guFile.metaData = changedFiles[i])) // update existing
                guFiles = existing
                    .map((guFile, i) => guFile || deserialize({metaData: changedFiles[i]})) // create new
                    .filter(guFile => !!guFile) // filter any broken / unrecognized
            }

            db.lastChangeId = changeList.largestChangeId;
            await FileManager.saveStateDb(db);
        }

        if (guFiles.length) {
            var tokens = await FileManager.getTokens();
            for (var i = 0; i < guFiles.length; i++) {
                await guFiles[i].update(tokens, publish).catch(err => {
                    gu.log.error('Failed to update', guFiles[i].id, guFiles[i].title)
                    gu.log.error(err);
                    gu.log.error(err.stack);
                });
            }
            await FileManager.saveGuFiles(guFiles);
        }
    }
}
