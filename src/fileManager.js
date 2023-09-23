import gu from '@guardian/koa-gu'
import { deserialize } from './guFile'
import drive from './drive'

const  _ = require('lodash');

export default {

    async getStateDb() {
        const stateDbString = await gu.db.get(gu.config.dbkey);
        return stateDbString ? JSON.parse(stateDbString) :
                                { lastChangeId: 0, lastSaved: new Date('1900-01-01') }
    },

    async saveStateDb(db) {
        db.lastSaved = new Date();
        return gu.db.set(gu.config.dbkey, JSON.stringify(db));
    },

    async getGuFiles(ids) {
        if (ids.length === 0) return [];

        const keys = ids.map(id => `${gu.config.dbkey}:${id}`)
        const strs = await gu.db.mget.call(gu.db, keys);
        const jsons = strs.map(JSON.parse);
        return jsons.map(json => json && deserialize(json));
    },

    async getAllGuFiles(start = 0, end = -1) {
        const ids = await gu.db.zrevrange(`${gu.config.dbkey}:index`, start, end);
        return ids.length ? await this.getGuFiles(ids) : [];
    },

    async saveGuFiles(files) {
        if (files.length === 0) return;

        const saveArgs = _.flatten( files.map(file => [`${gu.config.dbkey}:${file.id}`, file.serialize()]) )
        await gu.db.mset.call(gu.db, saveArgs);

        const indexArgs = _.flatten( files.map(file => [file.unixdate, file.id]) )
        indexArgs.unshift(`${gu.config.dbkey}:index`)
        await gu.db.zadd.call(gu.db, indexArgs);
    },

    async update({fetchAll = false, fileIds = [], prod = false}) {
        let guFiles;
        if (fileIds.length > 0) {
            guFiles = await this.getGuFiles(fileIds);
        } else {
            let db = await this.getStateDb();
            let changeList = fetchAll ?
                await drive.fetchAllChanges() :
                await drive.fetchRecentChanges(1 + Number(db.lastChangeId || 0));

            gu.log.info(`${changeList.data.items.length} changes. Largest ChangeId: ${changeList.data.largestChangeId}`);

            db.lastChangeId = changeList.data.largestChangeId;
            await this.saveStateDb(db);

            const filesMetadata = changeList.data.items.map(change => change.file).filter(f => f);
            const filesCache = await this.getGuFiles(filesMetadata.map(f => f.id));

            guFiles = _.zip(filesCache, filesMetadata)
                .map(([guFile, metaData]) => {
                    if (guFile) {
                        guFile.metaData = metaData;
                        return guFile;
                    } else {
                        return deserialize({metaData});
                    }
                })
                .filter(guFile => !!guFile); // filter any broken/unrecognized
        }

        const promises = guFiles.map(guFile => {
            return guFile.update(prod)
                .then(() => undefined)
                .catch(err => {
                    gu.log.error('Failed to update', guFile.id, guFile.title)
                    gu.log.error(err);
                    return guFile;
                });
        });

        const fails = (await Promise.all(promises)).filter(f => !!f);
        if (fails.length > 0) {
            gu.log.error('The following updates failed');
            fails.forEach(fail => gu.log.error(`\t${fail.id} ${fail.title}`));
        }

        await this.saveGuFiles(guFiles);
    }
}
