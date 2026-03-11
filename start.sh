#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — build (if needed) and run the TrackShop DoS lab
# Usage:
#   ./start.sh              # run existing image
#   ./start.sh --build      # force rebuild before running
# ─────────────────────────────────────────────────────────────────────────────
set -e

IMAGE="dos-lab:latest"
NAME="trackshop"
BUILD=false

for arg in "$@"; do
  [[ "$arg" == "--build" ]] && BUILD=true
done

# ── Stop any existing instance ────────────────────────────────────────────────
if docker ps -a --format "{{.Names}}" | grep -qx "$NAME"; then
  echo "[start] Removing existing container '$NAME'..."
  docker rm -f "$NAME" >/dev/null
fi

# ── Build ─────────────────────────────────────────────────────────────────────
if $BUILD || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "[start] Building $IMAGE..."
  docker build -t "$IMAGE" "$(dirname "$0")"
fi

# ── Run ───────────────────────────────────────────────────────────────────────
echo "[start] Starting $NAME..."
docker run -d \
  --name "$NAME" \
  -p 80:80 \
  "$IMAGE"

echo "[start] Lab is up → http://localhost"
echo "[start] DNS (dnsmasq) is reachable at the container IP shown on the dashboard"
echo "[start] Logs: docker logs -f $NAME"
echo "[start] Stop: docker rm -f $NAME"
