Google Docs to S3 uploader
==========================

- Google Docs -> ArchieML -> S3
- Google Sheets -> CSV -> JSON -> S3

Setup
-----

1. Install `redis` globally - `brew install redis` 
2. Make sure you are running the correct version of node. Install NVM if you don't have it it: `brew install nvm` and then
run `nvm use` in the root of the project.
3. Install the node packages: `npm install`
4. [Download service account `key.json`](docs/googleApis.md) from Google developer console into root directory

Running Locally
--------------

To run the UI: `./dev-start-ui.sh` (this starts the redis server + builds the webapp on auto-reload)

To fetch the latest Google docs: `./dev-start-fetch.sh`

OR:

- Development (auto-reload) - `npm run dev`
- Production - `npm run www`

To Deploy
--------------

*This deployment process is difficult to use and should be upgraded to RiffRaff asap*

- `ssm` into the Visuals server (you can now use ssm with [Janus credentials](https://janus.gutools.co.uk/multi-credentials?&permissionIds=interactives-dev&tzOffset=1); the instance lives in the Interactives AWS account).

```
ssm ssh -x -t visuals,PROD --profile interactives
```

- `cd` into the gudocs repo and git pull main. You may need to run commands like `npm install` if you have eg. installed any different dependencies.

This server uses `supervisor` to build apps on the box. To restart the apps, run the following:

```
sudo supervisorctl restart docs
sudo supervisorctl restart docsfetch
```

To see what each start/restart command does look at the `docs` and `docsfetch` entries in the `supervisor.conf` file in the root of the server.

To check error logs for a process run `supervisorctl tail -5000 procname stderr` replacing the process name as appropriate. 

Note: if testing anything from a branch, make sure to `git checkout main` when you're done.

More details on deploying to the [Visuals Server here](https://docs.google.com/document/d/1VUX-F-pAX1V-QXBtx8_U0ECEMtjdhcgmiBAgOXtmGHM/edit?ts=5e9d94b3#heading=h.d93zsvyk19tx)

Fetching/updating docs
----------------------

`npm run fetch` will fetch and update all docs/sheets shared with the service account email address. It will only refetch docs/sheets if they have changed. 

`npm run fetch -i <ID>` can be run to fetch an individual sheet, where <ID> is the id of the doc, which can be found in the url.
For example: https://docs.google.com/spreadsheets/d/1yICC65epwqbmljNMv9xg6x5T-m0JGkVmp2cvTU7J9j8 has the id "1yICC65epwqbmljNMv9xg6x5T-m0JGkVmp2cvTU7J9j8". 
