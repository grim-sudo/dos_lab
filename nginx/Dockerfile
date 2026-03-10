# ── Stage 1: build the Vite/TSX frontend ─────────────────────────────────────
# Build context is the project root so we can access both frontend/ and nginx/
FROM node:20-slim AS frontend_build

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci --prefer-offline

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Nginx on Debian slim ────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx \
    && rm -rf /var/lib/apt/lists/*

# Remove default vhost
RUN rm -f /etc/nginx/sites-enabled/default

COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy compiled frontend assets
COPY --from=frontend_build /app/dist /var/www/trackshop

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
