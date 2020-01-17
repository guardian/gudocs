Setting up Google APIs
======================

1. Visit [https://console.developers.google.com/](https://console.developers.google.com/)
2. Select a project > Create a project...
3. Create a project called `gudocs`
4. Go got Credentials > Create credentials > Service account key
5. Under "Service account" select "New service account". Give it a name (maybe use your own name). For "Key type" select "JSON". Click "Create"
6. A JSON file will be downloaded to your computer. Save this in the root directory of this project with the filename `key.json`

Accessing google Service account key
======================
we are using now Aws Systems Manager parameter store to ster the google Service account key

More details in [service-account-key.js](/src/service-account-key.js)

Enable Google Drive API
=======================

The first time you use your Google Drive API with your new project, you will need to enable it.

From the Google Developer Console, select your project and click Overview. Under Google Apps APIs, click Drive API. Click "Enable".

Enabling the API may take a few minutes to propagate to Google's systems. 

Enable Google Sheets API
============================

The first time you use your Google Sheets API with your new project, you will need to enable it.

From the Google Developer Console, select your project and click Overview. Under Google Apps APIs, click Sheets API. Click "Enable".

Enabling the API may take a few minutes to propagate to Google's systems.
