# Local Runbook

## 1. Start signaling/web app
```bash
cd /home/kjhz/ROS2_DASHBOARD
npm run dev:streaming
```

## 2. Start control service
```bash
cd /home/kjhz/ROS2_DASHBOARD
UNITY_PLAYER_PATH=/home/kjhz/UnityProjects/ros2_unity_rpi/ros2_unity_autoDriver/Build/RenderStreaming/RLStream.x86_64 \
WEBRTC_VIEWER_URL=http://127.0.0.1:8080/receiver/?autostart=1 \
WEBRTC_SIGNALING_URL=ws://127.0.0.1:8080 \
npm run dev:control
```

## 3. Start web dashboard
```bash
cd /home/kjhz/ROS2_DASHBOARD
NEXT_PUBLIC_CONTROL_API_BASE_URL=http://127.0.0.1:4000 npm run dev:web
```

## 4. Open dashboard
- `http://127.0.0.1:3000`
- click `START SIMULATION`
