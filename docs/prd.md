# Unity RL Web Streaming PRD

## Objective
Deliver a local-LAN web dashboard that reproduces the Unity `DrivingTrainerUI` landing page, starts a Unity RL standalone player, and embeds the live Render Streaming receiver in the browser.

## Scope
- Recreate the landing UI in the web app.
- Provide a control API to start, inspect, and stop a Unity standalone session.
- Bundle the official Unity Render Streaming signaling/web app inside `ROS2_DASHBOARD`.
- Render a simulation screen that embeds the receiver page in autostart mode.
- Keep v1 single-session, no-auth, no-database.

## Runtime topology
- `apps/web` on port `3000`
- `apps/control` on port `4000`
- `apps/renderstreaming` on port `8080`
- Unity standalone player launched by the control API with `-signalingUrl ws://127.0.0.1:8080`

## User flow
1. User opens the landing page.
2. User clicks `START SIMULATION`.
3. Web app calls the control API.
4. Control API launches the Unity standalone player.
5. Browser navigates to `/simulation` and embeds the receiver viewer.
6. Receiver negotiates WebRTC with the Unity player through the signaling server.

## Constraints
- Unity Editor play mode is not the target runtime for v1 streaming.
- A standalone player build is required.
- The Unity project must include the `com.unity.renderstreaming` package.
