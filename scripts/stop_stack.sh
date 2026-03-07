#!/usr/bin/env bash
set -euo pipefail

pkill -f 'node ./build/index.js' || true
pkill -f 'node dist/index.js' || true
pkill -f 'next start --port 3100' || true
pkill -f 'next dev --port 3000' || true
pkill -f 'RLStream.x86_64' || true

echo '[stack] stopped renderstreaming/control/web/unity-player processes if they were running.'
