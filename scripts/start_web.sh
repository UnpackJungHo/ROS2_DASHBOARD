#!/usr/bin/env bash
set -euo pipefail

cd /home/kjhz/ROS2_DASHBOARD/apps/web
export PORT="${PORT:-3100}"

echo "[web] starting on port ${PORT}"
exec ../../node_modules/.bin/next start --port "${PORT}"
