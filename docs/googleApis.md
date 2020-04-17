Setting up Google APIs
======================

1. Visit [https://console.developers.google.com/](https://console.cloud.google.com/iam-admin/serviceaccounts?orgonly=true&project=guardian-visuals&supportedpurview=organizationId)
2. Click on one of the service accounts. For development purposes, this is likely to be: `docs-tool-dev` or `docs-tool-code`. 
3. In the interface for that service account click "Edit", and then "Create Key".
4. Choose key type JSON and then click "Create".
5. A JSON file will be downloaded to your computer. Save this in the root directory of this project with the filename `key.json`

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
