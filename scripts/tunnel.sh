#!/bin/sh
# Makes the local dev app reachable from any network through a free Cloudflare quick tunnel,
# like VS Code's port forwarding. Open the printed https://….trycloudflare.com URL: invite
# links copied from there use that public address.
set -e
cd "$(dirname "$0")/.."

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed. On macOS: brew install cloudflared"
  exit 1
fi

set -a
. ./.env
set +a

exec cloudflared tunnel --url "http://localhost:${WEB_PORT}"
