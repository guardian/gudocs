#!/bin/bash -e

# Script that posts the output of fetch-all-redis.sh to gudocs2 legacy endpoint

STAGE=$1

if [ "$STAGE" = "LOCAL" ]; then
  domain="gudocs.local.dev-gutools.co.uk"
elif [ "$STAGE" = "CODE" ]; then
  domain="gudocs.code.dev-gutools.co.uk"
elif [ "$STAGE" = "PROD" ]; then
  domain="gudocs.gutools.co.uk"
else
  >&2 echo "Unrecognised stage $STAGE"
  >&2 echo "Usage: $0 (LOCAL|CODE|PROD)"
  exit 1
fi

while read -r line
do 
  curl -X POST \
    "https://gudocs.local.dev-gutools.co.uk/legacy?api-key=$API_KEY" \
    -H 'Content-Type: application/json' \
    -d "$line"
done
