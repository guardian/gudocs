# Instruction on running the app locally
and performing basic mannual tests

## Requirements:
1. Google account with google drive
2. "Service account" key for google API project
3. Janus creds for composer account so that you will have access to s3 bucket `gudocs-dev`

## connecting to Google account and google app project

- you can connect app to any google account for testing purpose 
- the app is using google drive changes API https://developers.google.com/drive/api/v2/manage-changes to track the changes in the fiels
- getting acces to google drive API
you will need to get the "Service account" key
look at instructions in [googleApis.md](/docs/googleApis.md) file to see instructions on how to do that

## how to track google documents by the app

When you create a "Service account" key an email address for that project will be generated
in a form `<key-name>@<project-name>.iam.gserviceaccount.com`

then once you create any doc in google docs or sheets you will need to share it with the email address of the google api project `<key-name>@<project-name>.iam.gserviceaccount.com`

after that the app should track all the changes/editis in any file you share

## preforming simple manual test

you will need redis running locally 

run `./dev-start-ui.sh` and you will see the UI at http://localhost:4001/ that lists the files (it should be blank once you run it for the first time with a freash google account)

run `./dev-start-fetch.sh` that will hit google drive changes api and update locally running REDIS with information about google docs file changes

then you should see details abput the files that you shared with the app email `<key-name>@<project-name>.iam.gserviceaccount.com`

editi something in the file in google docs/sheets shared with `<key-name>@<project-name>.iam.gserviceaccount.com` 
un `./dev-start-fetch.sh` again 
and you should see the updates in the ui