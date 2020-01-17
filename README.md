Google Docs to S3 uploader
==========================

- Google Docs -> ArchieML -> S3
- Google Sheets -> CSV -> JSON -> S3

Setup
-----

1. Install `redis`
2. `npm install`

Running server
--------------

- Development (auto-reload) - `npm run dev`
- Production - `npm run www`

Fetching/updating docs
----------------------

`npm run fetch` will fetch and update all docs/sheets shared with the service account email address.


Google Service accounts emails:

- prod `docs-tool@guardian-visuals.iam.gserviceaccount.com`
- code `docs-tool-code@guardian-visuals.iam.gserviceaccount.com`
- dev `docs-tool-dev@guardian-visuals.iam.gserviceaccount.com`