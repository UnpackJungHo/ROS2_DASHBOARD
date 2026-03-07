import cors from "cors";
import express from "express";
import { spawn, type ChildProcess } from "node:child_process";
import { nanoid } from "nanoid";
import { z } from "zod";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const unityScene = process.env.UNITY_SCENE_NAME ?? "RL";
const signalingUrl = process.env.WEBRTC_SIGNALING_URL ?? "ws://127.0.0.1:8080";
const viewerUrl =
  process.env.WEBRTC_VIEWER_URL ?? "http://127.0.0.1:8080/receiver/?autostart=1";
const unityLaunchCommand = resolveUnityLaunchCommand();

const startRequestSchema = z.object({
  requestedBy: z.string().default("web-ui"),
});

type SessionState = "launching" | "awaiting_stream" | "stream_ready" | "failed" | "stopped";

interface SessionRecord {
  sessionId: string;
  state: SessionState;
  message: string;
  launchedAt: string;
  requestedBy: string;
  unityScene: string;
  pid: number | null;
  child?: ChildProcess;
}

const sessions = new Map<string, SessionRecord>();

function resolveUnityLaunchCommand(): string | undefined {
  if (process.env.UNITY_LAUNCH_CMD?.trim()) {
    return process.env.UNITY_LAUNCH_CMD.trim();
  }

  const playerPath = process.env.UNITY_PLAYER_PATH?.trim();
  if (!playerPath) {
    return undefined;
  }

  const escapedPath = playerPath.replace(/"/g, '\\"');
  const escapedSignalingUrl = signalingUrl.replace(/"/g, '\\"');
  return `"${escapedPath}" -signalingType websocket -signalingUrl "${escapedSignalingUrl}"`;
}

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "ros2-dashboard-control",
    activeSessions: Array.from(sessions.values()).filter((session) => session.state !== "stopped")
      .length,
    viewerUrl,
    signalingUrl,
    unityScene,
    unityLaunchConfigured: Boolean(unityLaunchCommand),
  });
});

app.post("/api/sessions/start", (req, res) => {
  // Kill all existing active sessions and their Unity processes before starting a new one
  for (const session of sessions.values()) {
    if (session.state !== "stopped") {
      if (session.pid) {
        try { process.kill(session.pid, "SIGTERM"); } catch {}
      }
      session.state = "stopped";
      session.message = "Replaced by new session.";
    }
  }

  const parsed = startRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      message: parsed.error.flatten(),
    });
  }

  const sessionId = nanoid(10);
  const session: SessionRecord = {
    sessionId,
    state: "launching",
    message: unityLaunchCommand
      ? "Launching Unity player and preparing the WebRTC viewer."
      : "Set UNITY_PLAYER_PATH or UNITY_LAUNCH_CMD so the control service can launch Unity.",
    launchedAt: new Date().toISOString(),
    requestedBy: parsed.data.requestedBy,
    unityScene,
    pid: null,
  };

  if (unityLaunchCommand) {
    try {
      const child = spawn(unityLaunchCommand, {
        shell: true,
        detached: true,
        stdio: "ignore",
      });

      child.unref();
      session.child = child;
      session.pid = child.pid ?? null;
      session.state = viewerUrl ? "stream_ready" : "awaiting_stream";
      session.message = viewerUrl
        ? "Unity launch command was issued. The receiver page is ready to negotiate WebRTC."
        : "Unity launch command was issued, but no viewer URL is configured yet.";
    } catch (error) {
      session.state = "failed";
      session.message = error instanceof Error ? error.message : "Failed to launch Unity player.";
    }
  } else {
    session.state = "awaiting_stream";
  }

  sessions.set(sessionId, session);

  return res.status(202).json({
    sessionId: session.sessionId,
    state: session.state,
    message: session.message,
    viewerUrl,
    signalingUrl,
    unityScene: session.unityScene,
  });
});

app.get("/api/sessions/:sessionId/status", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ message: "Session not found." });
  }

  return res.json({
    sessionId: session.sessionId,
    state: session.state,
    message: session.message,
    viewerUrl,
    signalingUrl,
    unityScene: session.unityScene,
    launchedAt: session.launchedAt,
    pid: session.pid,
  });
});

app.post("/api/sessions/:sessionId/stop", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ message: "Session not found." });
  }

  if (session.pid) {
    try {
      process.kill(session.pid, "SIGTERM");
    } catch {
      // The player may already be gone. We still transition the state.
    }
  }

  session.state = "stopped";
  session.message = "Session stopped.";

  return res.json({
    sessionId: session.sessionId,
    state: session.state,
    message: session.message,
    viewerUrl,
    signalingUrl,
    unityScene: session.unityScene,
    launchedAt: session.launchedAt,
    pid: session.pid,
  });
});

app.listen(port, () => {
  console.log(`ROS2 dashboard control service listening on http://localhost:${port}`);
  console.log(`Signaling URL: ${signalingUrl}`);
  console.log(`Viewer URL: ${viewerUrl}`);
  if (!unityLaunchCommand) {
    console.log("Unity launch command is not configured yet.");
  }
});
