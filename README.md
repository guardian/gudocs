Google Docs to S3 uploader
==========================

- Google Docs -> ArchieML -> S3
- Google Sheets -> CSV -> JSON -> S3

Setup
-----

1. Install `redis`
1. `npm install`
1. [Download service account `key.json`](docs/googleApis.md) from Google developer console into root directory

Running server
--------------

- Development (auto-reload) - `npm run dev`
- Production - `npm run www`

To Deploy
--------------

Ssh into the Visuals server. Cd into the gudocs repo and git pull master. If necessary, run the build script. `./build.sh`.


Fetching/updating docs
----------------------

`npm run fetch` will fetch and update all docs/sheets shared with the service account email address.
