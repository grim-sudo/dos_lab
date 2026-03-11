#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# entrypoint.sh
# 1. Initialise the PostgreSQL database (idempotent — skips if already done)
# 2. Hand off to supervisord which manages postgres, backend, and nginx
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "[entrypoint] Running database initialisation..."
/usr/local/bin/init-db.sh

echo "[entrypoint] Starting supervisord..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
