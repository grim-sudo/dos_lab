# ─────────────────────────────────────────────────────────────────────────────
# TrackShop DoS Lab — All-in-One Dockerfile
#
# Runs PostgreSQL + Node.js backend + Nginx + dnsmasq in a single Debian
# bookworm-slim container managed by supervisord.
#
# Build:  docker build -t dos-lab .
# Run:    docker run -d -p 80:80 --name dos dos-lab:latest
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build the Vite/TSX frontend ─────────────────────────────────────
FROM node:20-slim AS frontend_build

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --prefer-offline
COPY frontend/ ./
RUN npm run build

# ── Stage 2: all-in-one runtime image ────────────────────────────────────────
FROM debian:bookworm-slim

# ── System packages ───────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        # Process supervisor
        supervisor \
        # Web server
        nginx \
        # PostgreSQL 15
        postgresql \
        postgresql-client \
        # Node.js runtime (from nodesource — bookworm has Node 18, we want 20)
        curl \
        ca-certificates \
        gnupg \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
         | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] \
         https://deb.nodesource.com/node_20.x nodistro main" \
         > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && apt-get install -y --no-install-recommends dnsmasq \
    && rm -rf /var/lib/apt/lists/*

# ── Nginx configuration ───────────────────────────────────────────────────────
RUN rm -f /etc/nginx/sites-enabled/default
# Use the standalone config (proxies to 127.0.0.1:3000, not the compose IP)
COPY docker/nginx-standalone.conf /etc/nginx/nginx.conf

# ── dnsmasq configuration ─────────────────────────────────────────────────────
# Intentionally vulnerable: cache disabled, no rate limiting, large TXT records
RUN mkdir -p /etc/dnsmasq.d && rm -f /etc/dnsmasq.conf && touch /etc/dnsmasq.conf
COPY docker/dnsmasq.conf /etc/dnsmasq.d/lab.conf

# ── Frontend static assets ────────────────────────────────────────────────────
COPY --from=frontend_build /app/dist /var/www/trackshop

# ── Backend application ───────────────────────────────────────────────────────
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/ ./

# ── Database initialisation ───────────────────────────────────────────────────
COPY database/init.sql /docker-entrypoint-initdb/init.sql

# ── Bootstrap script: initialises PostgreSQL on first run ────────────────────
COPY docker/init-db.sh /usr/local/bin/init-db.sh
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/init-db.sh /usr/local/bin/entrypoint.sh

# ── supervisord configuration ─────────────────────────────────────────────────
COPY docker/supervisord.conf /etc/supervisor/conf.d/trackshop.conf

# ── Create log directories ────────────────────────────────────────────────────
RUN mkdir -p /var/log/supervisor /var/log/trackshop

EXPOSE 80
EXPOSE 53/udp

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
