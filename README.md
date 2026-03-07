# ROS2_DASHBOARD

Monorepo for the web dashboard, Render Streaming signaling/web app, and control plane that launch and stream the Unity RL simulator.

## Apps
- `apps/web`: Next.js landing page and simulation dashboard.
- `apps/control`: Express control API for Unity session lifecycle.
- `apps/renderstreaming`: Official Unity Render Streaming web app and signaling server.
- `packages/shared`: shared types.

## Local run
1. Start the Render Streaming web app on port `8080`.
2. Start the control API on port `4000`.
3. Start the Next.js web app on port `3000`.
4. Configure `UNITY_PLAYER_PATH` or `UNITY_LAUNCH_CMD` in the control service.
