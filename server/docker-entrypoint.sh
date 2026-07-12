#!/bin/sh
set -e

npx prisma migrate deploy

# seed.ts is idempotent (upsert-based), so re-running it on every boot is safe —
# but a real deployment shouldn't silently plant test@abv.bg/password, so this
# only runs outside production, same NODE_ENV-gating pattern used elsewhere
# (refresh-cookie secure flag, CSP upgrade-insecure-requests directive).
if [ "$NODE_ENV" != "production" ]; then
  npx prisma db seed
fi

exec "$@"
