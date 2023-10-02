export GU_aws_profile="composer"
export GU_s3bucket="gudocs-dev"
export GU_s3domain="not-used"
export GU_dbkey="gudocs-dev"
export GU_require_domain_permissions="dev-guardian.co.uk"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

nvm install

npm run fetch

# to fetch a single file run with the id of the google doc
# npm run fetch -i ID
