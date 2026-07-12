#!/bin/sh
set -e

npx prisma migrate deploy

# Idempotent, but skip in production so we don't plant test@abv.bg on a live site.
if [ "$NODE_ENV" != "production" ]; then
  npx prisma db seed
fi

exec "$@"
