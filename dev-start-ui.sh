export GU_aws_profile="composer"
export GU_s3bucket="gudocs-dev"
export GU_s3domain="not-used"
export GU_sns_errors="not-used"
export GU_dbkey="gudocs-dev"
export GU_require_domain_permissions="dev-guardian.co.uk"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

nvm install

# run redis server in the background
redis-server &

npm run dev