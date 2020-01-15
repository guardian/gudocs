Redis is used here as a main persitence source
======================

It persists the data that we can see on the https://visuals.gutools.co.uk/docs/ page

so mainly the `gudocs:index` key have the keys of the files that we see on the table on web page, `gudocs` have the details about last modified

once you log into the machine that runs redis youc an use redis-cli to perform queries

`redis-cli ZRANGE gudocs:index 0 -1 WITHSCORES` that will list the files ids, example response

    1) "111111"
    2) "222222"

and then you can query the file details by `redis-cli GET gudocs:111111`, example reposne:

```json
{"metaData":{"kind":"drive#file","id":"111111","etag":"30jMLj3-m0JdGNLPUS2QqbEXiN0/MTU3OTA4MTUyNDUwNg","selfLink":"https://www.googleapis.com/drive/v2/files/111111","alternateLink":"https://docs.google.com/spreadsheets/d/111111/edit?usp=drivesdk","embedLink":"https://...","iconLink":"https://...","thumbnailLink":"https://...","title":"Ocean pools project","mimeType":"application/vnd.google-apps.spreadsheet","labels":{"starred":false,"hidden":false,"trashed":false,"restricted":false,"viewed":false},"copyRequiresWriterPermission":false,"createdDate":"2019-06-04T05:58:45.355Z","modifiedDate":"2020-01-15T09:45:24.506Z","markedViewedByMeDate":"1970-01-01T00:00:00.000Z","sharedWithMeDate":"2019-06-14T04:52:24.420Z","version":"278","sharingUser":{"kind":"drive#user","displayName":"Andy Ball","isAuthenticatedUser":false,"permissionId":"....","emailAddress":"andy.ball@guardian.co.uk"},"parents":[],"exportLinks":{"application/x-vnd.oasis.opendocument.spreadsheet":"https://...","text/tab-separated-values":"https://d...","application/pdf":"https://...":"https://...","text/csv":"https://...","application/zip":"https://...","application/vnd.oasis.opendocument.spreadsheet":"https://d..."},"userPermission":{"kind":"drive#permission","etag":"43675648","id":"me","selfLink":"https://www.googleapis.com/drive/v2/files/11111/permissions/me","role":"writer","type":"user"},"quotaBytesUsed":"0","ownerNames":["John Doe"],"owners":[{"kind":"drive#user","displayName":"John Doe","picture":{"url":"https://lh3.googleusercontent.com/a-/..."},"isAuthenticatedUser":false,"permissionId":"....","emailAddress":"j.d@guardian.co.uk"}],"lastModifyingUserName":"John Doe","lastModifyingUser":{"kind":"drive#user","displayName":"John Doe","picture":{"url":"https://lh3.googleusercontent.com/a-/..."},"isAuthenticatedUser":false,"permissionId":"....","emailAddress":"j.d@guardian.co.uk"},"capabilities":{"canCopy":true,"canEdit":true},"editable":true,"copyable":true,"writersCanShare":true,"shared":true,"explicitlyTrashed":false,"appDataContents":false,"spaces":["drive"]},"lastUploadTest":"2020-01-15T09:45:24.506Z","lastUploadProd":"2020-01-15T07:22:25.257Z","domainPermissions":"none","properties":{"isTable":false}}
```

`redis-cli GET gudocs` will give you the details about the last saved, example reposne:

```json
"{"lastChangeId":"4","lastSaved":"2020-01-14T18:23:05.864Z"}"
```





