#!/bin/bash
# Start the ROS2 Dashboard backend server
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

source /opt/ros/jazzy/setup.bash
source "$PROJECT_DIR/venv/bin/activate"

cd "$PROJECT_DIR"
exec python -m uvicorn backend.backend.main:app --host 0.0.0.0 --port 8000 --reload
