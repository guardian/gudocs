import google from 'googleapis'
var key = require('../key.json');

export var jwtClient = new google.auth.JWT(
	key.client_email,
	null,
	key.private_key,
	['https://www.googleapis.com/auth/drive']
);
