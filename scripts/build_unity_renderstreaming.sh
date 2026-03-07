#!/usr/bin/env bash
set -euo pipefail
UNITY_EDITOR="${UNITY_EDITOR:-/home/kjhz/Unity/Hub/Editor/2022.3.62f3/Editor/Unity}"
PROJECT_PATH="${PROJECT_PATH:-/home/kjhz/UnityProjects/ros2_unity_rpi/ros2_unity_autoDriver}"
LOG_PATH="${LOG_PATH:-$PROJECT_PATH/Logs/build-renderstreaming.log}"
mkdir -p "$(dirname "$LOG_PATH")"
"$UNITY_EDITOR" -batchmode -quit -projectPath "$PROJECT_PATH" -executeMethod BuildRenderStreamingPlayer.BuildLinuxPlayer -logFile "$LOG_PATH"
