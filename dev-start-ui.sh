export GU_aws_profile="composer"
export GU_s3bucket="gudocs-dev"
export GU_s3domain="not-used"
export GU_dbkey="gudocs-dev"
export GU_require_domain_permissions="dev-guardian.co.uk"

cleanup() {
  docker stop redis-gudocs
  docker rm redis-gudocs
  exit
}

nvm install

trap 'cleanup' INT TERM EXIT

docker run --name redis-gudocs -p 6379:6379 -d redis

npm run dev
