#!/bin/bash
cd "$(dirname "${BASH_SOURCE[0]}")"
CMD="./node_modules/.bin/babel-node --harmony ./src/fetch.js"
while true; do $CMD; sleep 15; done
