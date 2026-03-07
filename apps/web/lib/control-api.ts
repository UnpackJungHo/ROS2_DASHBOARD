export type SessionState =
  | "launching"
  | "awaiting_stream"
  | "stream_ready"
  | "failed"
  | "stopped";

export interface StartSessionResponse {
  sessionId: string;
  state: SessionState;
  message: string;
  viewerUrl: string | null;
  signalingUrl: string | null;
  unityScene: string;
}

export interface SessionStatusResponse extends StartSessionResponse {
  launchedAt: string;
  pid: number | null;
}

const baseUrl =
  process.env.NEXT_PUBLIC_CONTROL_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

export async function startSession(): Promise<StartSessionResponse> {
  const response = await fetch(`${baseUrl}/api/sessions/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requestedBy: "web-ui" }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to start session.");
  }

  return response.json();
}

export async function fetchSessionStatus(
  sessionId: string,
): Promise<SessionStatusResponse> {
  const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/status`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to fetch session status.");
  }

  return response.json();
}
