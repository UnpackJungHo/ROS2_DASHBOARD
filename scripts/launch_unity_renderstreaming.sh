#!/usr/bin/env bash
set -euo pipefail
PLAYER_PATH="${UNITY_PLAYER_PATH:-/home/kjhz/UnityProjects/ros2_unity_rpi/ros2_unity_autoDriver/Build/RenderStreaming/RLStream.x86_64}"
SIGNALING_URL="${WEBRTC_SIGNALING_URL:-ws://127.0.0.1:8080}"
chmod +x "$PLAYER_PATH"
"$PLAYER_PATH" -signalingType websocket -signalingUrl "$SIGNALING_URL"
