export type SessionState =
  | "launching"
  | "awaiting_stream"
  | "stream_ready"
  | "failed"
  | "stopped";

export interface StartSessionRequest {
  requestedBy: string;
}

export interface SessionSummary {
  sessionId: string;
  state: SessionState;
  message: string;
  viewerUrl: string | null;
  signalingUrl: string | null;
  unityScene: string;
}

export interface SessionStatus extends SessionSummary {
  launchedAt: string;
  pid: number | null;
}
