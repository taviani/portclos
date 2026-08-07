#!/bin/sh
set -eu

# API runs as nobody, but Docker named volumes are often root-owned.
# Fix ownership before dropping privileges so photo uploads can write.
UPLOAD_DIR="${UPLOAD_DIR:-/data/uploads}"
mkdir -p "$UPLOAD_DIR"
chown -R nobody:nogroup "$UPLOAD_DIR"

exec su-exec nobody /app/server "$@"
