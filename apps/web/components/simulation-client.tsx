"use client";

import { useEffect, useState } from "react";
import { fetchSessionStatus, type SessionStatusResponse } from "@/lib/control-api";

interface SimulationClientProps {
  sessionId: string;
  initialStatus: SessionStatusResponse | null;
  initialErrorMessage: string | null;
}

interface Diagnostics {
  controlApi: boolean;
  signalingServer: boolean;
}

type CheckStatus = "ok" | "fail" | "pending";

function CheckRow({ label, status, detail }: { label: string; status: CheckStatus; detail?: string }) {
  const icon = status === "ok" ? "✅" : status === "fail" ? "❌" : "⏳";
  const color = status === "ok" ? "#22c55e" : status === "fail" ? "#e53e5a" : "#f59e0b";
  return (
    <div className="diag-row">
      <span className="diag-icon" style={{ color }}>{icon}</span>
      <span className="diag-label">{label}</span>
      {detail && <span className="diag-detail">{detail}</span>}
    </div>
  );
}

function getUnityStatus(status: SessionStatusResponse | null): CheckStatus {
  if (!status) return "pending";
  if (status.state === "stream_ready") return "ok";
  if (status.state === "failed" || status.state === "stopped") return "fail";
  return "pending";
}

function getWebRTCStatus(status: SessionStatusResponse | null): CheckStatus {
  if (!status?.viewerUrl) return "fail";
  if (status.state === "stream_ready") return "ok";
  return "pending";
}

export function SimulationClient({
  sessionId,
  initialStatus,
  initialErrorMessage,
}: SimulationClientProps) {
  const [status, setStatus] = useState<SessionStatusResponse | null>(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);
  const [diag, setDiag] = useState<Diagnostics | null>(null);

  // Poll session status
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchSessionStatus(sessionId);
        if (!cancelled) {
          setStatus(next);
          setErrorMessage(null);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to read session status.",
          );
        }
      }
    };

    void load();
    const timer = window.setInterval(load, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  // Poll diagnostics
  useEffect(() => {
    let cancelled = false;

    const loadDiag = async () => {
      try {
        const res = await fetch("/api/diagnostics", { cache: "no-store" });
        if (!cancelled && res.ok) {
          setDiag(await res.json());
        }
      } catch {
        // silent
      }
    };

    void loadDiag();
    const timer = window.setInterval(loadDiag, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const allReady =
    diag?.controlApi &&
    diag?.signalingServer &&
    getUnityStatus(status) === "ok" &&
    getWebRTCStatus(status) === "ok";

  const renderViewport = () => {
    if (status?.viewerUrl) {
      return (
        <iframe
          title="Unity stream viewer"
          src={status.viewerUrl}
          className="stream-frame"
          allow="camera; microphone; autoplay; fullscreen; pointer-lock; keyboard-map"
          allowFullScreen
        />
      );
    }

    return (
      <div className="stream-placeholder">
        <div>
          <p className="eyebrow">STREAM VIEW</p>
          <h2>Viewer endpoint not configured yet</h2>
          <p>
            Set <code>WEBRTC_VIEWER_URL</code> in the control service to embed the live WebRTC viewer here.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="simulation-layout">
      <section className="stream-panel">{renderViewport()}</section>

      <aside className="control-panel">
        {/* ── Connection Checklist ── */}
        <div className="info-card diag-card">
          <p className="eyebrow">CONNECTION STATUS</p>
          <div className="diag-list">
            <CheckRow
              label="Control API (4000)"
              status={diag == null ? "pending" : diag.controlApi ? "ok" : "fail"}
              detail={diag?.controlApi ? "Connected" : "Not reachable"}
            />
            <CheckRow
              label="Signaling Server (8080)"
              status={diag == null ? "pending" : diag.signalingServer ? "ok" : "fail"}
              detail={diag?.signalingServer ? "Connected" : "npm run dev:streaming 실행 필요"}
            />
            <CheckRow
              label="Unity Player"
              status={getUnityStatus(status)}
              detail={
                status?.pid
                  ? `PID ${status.pid} · ${status.state}`
                  : status?.state === "failed"
                  ? "실행 실패 — 경로/권한 확인"
                  : "실행 대기 중"
              }
            />
            <CheckRow
              label="WebRTC Stream"
              status={getWebRTCStatus(status)}
              detail={
                getWebRTCStatus(status) === "ok"
                  ? "Viewer URL 준비됨"
                  : "Unity 연결 후 협상 시작"
              }
            />
          </div>
          {allReady && (
            <p className="diag-ready">모든 서비스 연결 완료 — 영상이 표시됩니다.</p>
          )}
        </div>

        {/* ── Session Info ── */}
        <div className="info-card">
          <p className="eyebrow">SESSION</p>
          <h1>{sessionId}</h1>
          <p className="status-line">State: {status?.state ?? "connecting"}</p>
          <p>{status?.message ?? "Waiting for control plane response..."}</p>
        </div>

        <div className="info-card">
          <p className="eyebrow">UNITY</p>
          <p>Scene: {status?.unityScene ?? "RL"}</p>
          <p>PID: {status?.pid ?? "n/a"}</p>
          <p>Launched: {status?.launchedAt ?? "pending"}</p>
        </div>

        <div className="info-card">
          <p className="eyebrow">WEBRTC</p>
          <p>Viewer URL: {status?.viewerUrl ?? "not set"}</p>
          <p>Signaling URL: {status?.signalingUrl ?? "not set"}</p>
        </div>

        {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
      </aside>
    </div>
  );
}
