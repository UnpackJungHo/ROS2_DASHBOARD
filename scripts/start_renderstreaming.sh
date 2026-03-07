#!/usr/bin/env bash
set -euo pipefail

cd /home/kjhz/ROS2_DASHBOARD/apps/renderstreaming
export PORT="${PORT:-8080}"

echo "[renderstreaming] starting on port ${PORT}"
exec node build/index.js
