#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
chmod 700 backups
umask 077
stamp=$(date -u +%Y%m%dT%H%M%SZ)
# Credentials stay in the ignored env file, not in shell command arguments.
docker run --rm --env-file deploy/production.env mongo:8.0 sh -c 'mongodump --uri="$MONGODB_URI" --archive --gzip' > "backups/database-$stamp.archive.gz"
docker compose run --rm --no-deps app tar -cz -C /app/backend/uploads . > "backups/uploads-$stamp.tar.gz"
printf 'Backups saved in backups/ for %s. Copy securely off this server and test restoration.\n' "$stamp"
