import gu from 'koa-gu'
import { _ } from 'lodash'
import { deserialize } from './guFile'
import drive from './drive'

export default {
    async getStateDb() {
        var stateDbString = await gu.db.get(gu.config.dbkey);
        return stateDbString ? JSON.parse(stateDbString) :
                                { lastChangeId: 0, lastSaved: new Date('1900-01-01') }
    },

    async saveStateDb(db) {
        db.lastSaved = new Date();
        return gu.db.set(gu.config.dbkey, JSON.stringify(db));
    },

    async getGuFiles(ids) {
        var keys = ids.map(id => `${gu.config.dbkey}:${id}`)
        var strs = await gu.db.mget.call(gu.db, keys);
        var jsons = strs.map(JSON.parse);
        return jsons.map(json => json && deserialize(json));
    },

    async getAllGuFiles(start = 0, end = -1) {
        var ids = await gu.db.zrevrange(`${gu.config.dbkey}:index`, start, end);
        return ids.length ? await this.getGuFiles(ids) : [];
    },

    async saveGuFiles(files) {
        var saveArgs = _.flatten( files.map(file => [`${gu.config.dbkey}:${file.id}`, file.serialize()]) )
        await gu.db.mset.call(gu.db, saveArgs);

        var indexArgs = _.flatten( files.map(file => [file.unixdate, file.id]) )
        indexArgs.unshift(`${gu.config.dbkey}:index`)
        await gu.db.zadd.call(gu.db, indexArgs);
    },

    async update({fetchAll = false, fileId = '', publish = false}) {
        var guFiles = [];
        if (fileId) {
            guFiles = await this.getGuFiles([fileId]);
        } else {
            var db = await this.getStateDb();
            var changeList;

            if (fetchAll) {
                changeList = await drive.fetchAllChanges();
                gu.log.info(`${changeList.items.length} changes. Largest ChangeId: ${changeList.largestChangeId}`)
            } else {
                var startChangeId = 1 + Number(db.lastChangeId);
                changeList = await drive.fetchRecentChanges(startChangeId);
                gu.log.info(`${changeList.items.length} new changes since ChangeId ${startChangeId}. Largest ChangeId: ${changeList.largestChangeId}`)
            }

            if (changeList.items.length > 0) {
                var changedFiles = changeList.items.map(change => change.file).filter(f => f)
                var ids = changedFiles.map(file => file.id);
                var existing = await this.getGuFiles(ids);
                existing.forEach((guFile, i) => guFile && (guFile.metaData = changedFiles[i])) // update existing
                guFiles = existing
                    .map((guFile, i) => guFile || deserialize({metaData: changedFiles[i]})) // create new
                    .filter(guFile => !!guFile) // filter any broken / unrecognized
            }

            db.lastChangeId = changeList.largestChangeId;
            await this.saveStateDb(db);
        }

        if (guFiles.length) {
            for (var i = 0; i < guFiles.length; i++) {
                await guFiles[i].update(publish).catch(err => {
                    gu.log.error('Failed to update', guFiles[i].id, guFiles[i].title)
                    gu.log.error(err);
                    gu.log.error(err.stack);
                });
            }
            await this.saveGuFiles(guFiles);
        }
    }
}
