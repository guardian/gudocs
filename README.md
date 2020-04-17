Google Docs to S3 uploader
==========================

- Google Docs -> ArchieML -> S3
- Google Sheets -> CSV -> JSON -> S3

Setup
-----

1. Install `redis` globally - `npm install -g redis` 
2. Make sure you are running the correct version of node. Install NVM if you don't have it it: `brew install nvm` and then
run `nvm use` in the root of the project.
3. Install the node packages: `npm install`
3. [Download service account `key.json`](docs/googleApis.md) from Google developer console into root directory

Running server
--------------

- Development (auto-reload) - `npm run dev`
- Production - `npm run www`

Fetching/updating docs
----------------------

`npm run fetch` will fetch and update all docs/sheets shared with the service account email address. It will only refetch docs/sheets if they have changed. 

`npm run fetch -i <ID>` can be run to fetch an individual sheet, where <ID> is the id of the doc, which can be found in the url.
For example: https://docs.google.com/spreadsheets/d/1yICC65epwqbmljNMv9xg6x5T-m0JGkVmp2cvTU7J9j8 has the id "1yICC65epwqbmljNMv9xg6x5T-m0JGkVmp2cvTU7J9j8". 
