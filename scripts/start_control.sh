#!/usr/bin/env bash
set -euo pipefail

cd /home/kjhz/ROS2_DASHBOARD/apps/control
export PORT="${PORT:-4000}"
export UNITY_PLAYER_PATH="${UNITY_PLAYER_PATH:-/home/kjhz/UnityProjects/ros2_unity_rpi/ros2_unity_autoDriver/Build/RenderStreaming/RLStream.x86_64}"
export WEBRTC_VIEWER_URL="${WEBRTC_VIEWER_URL:-http://127.0.0.1:8080/receiver/?autostart=1}"
export WEBRTC_SIGNALING_URL="${WEBRTC_SIGNALING_URL:-ws://127.0.0.1:8080}"

echo "[control] PORT=${PORT}"
echo "[control] UNITY_PLAYER_PATH=${UNITY_PLAYER_PATH}"
echo "[control] WEBRTC_VIEWER_URL=${WEBRTC_VIEWER_URL}"
echo "[control] WEBRTC_SIGNALING_URL=${WEBRTC_SIGNALING_URL}"
exec node dist/index.js
