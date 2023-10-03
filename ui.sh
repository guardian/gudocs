#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

nvm install

cd "$(dirname "${BASH_SOURCE[0]}")"
./node_modules/.bin/babel-node --harmony ./src/cli.js
