#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# init-db.sh — run once on container start to prepare the PostgreSQL cluster
# Called by entrypoint.sh before supervisord starts.
#
# Debian note: pg_createcluster already ran during apt-get install, so the
# cluster exists but is stopped. Config lives in /etc/postgresql/15/main/.
# ─────────────────────────────────────────────────────────────────────────────
set -e

INIT_FLAG=/var/lib/postgresql/.db_initialised

# Skip if already done (container restart)
if [ -f "$INIT_FLAG" ]; then
    echo "[init-db] Database already initialised — skipping."
    exit 0
fi

PG_HBA=/etc/postgresql/15/main/pg_hba.conf

echo "[init-db] Temporarily allowing trust auth for local connections..."
# Prepend trust rule so it takes priority over the default peer/md5 lines
printf "local all all trust\n" | cat - "$PG_HBA" > /tmp/pg_hba_tmp && mv /tmp/pg_hba_tmp "$PG_HBA"
chown postgres:postgres "$PG_HBA"

echo "[init-db] Starting PostgreSQL temporarily for user/DB creation..."
pg_ctlcluster 15 main start

echo "[init-db] Creating role and database..."
su postgres -c "psql -v ON_ERROR_STOP=1 -c \
    \"CREATE ROLE appuser WITH LOGIN PASSWORD 'apppassword';\""

su postgres -c "psql -v ON_ERROR_STOP=1 -c \
    \"CREATE DATABASE trackshop OWNER appuser;\""

echo "[init-db] Running seed SQL..."
su postgres -c "psql -v ON_ERROR_STOP=1 -U appuser -d trackshop \
    -f /docker-entrypoint-initdb/init.sql"

echo "[init-db] Stopping temporary PostgreSQL..."
pg_ctlcluster 15 main stop

echo "[init-db] Restoring pg_hba.conf to scram-sha-256 auth..."
# Remove the first line (the trust line we prepended)
tail -n +2 "$PG_HBA" > /tmp/pg_hba_tmp && mv /tmp/pg_hba_tmp "$PG_HBA"
chown postgres:postgres "$PG_HBA"

touch "$INIT_FLAG"
echo "[init-db] Done."
