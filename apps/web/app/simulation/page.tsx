import Link from "next/link";
import { SimulationClient } from "@/components/simulation-client";
import type { SessionStatusResponse } from "@/lib/control-api";

const controlApiBaseUrl =
  process.env.NEXT_PUBLIC_CONTROL_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";

async function getInitialStatus(sessionId: string) {
  try {
    const response = await fetch(`${controlApiBaseUrl}/api/sessions/${sessionId}/status`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        status: null,
        errorMessage: text || "Failed to fetch the simulation status.",
      };
    }

    return {
      status: (await response.json()) as SessionStatusResponse,
      errorMessage: null,
    };
  } catch (error) {
    return {
      status: null,
      errorMessage:
        error instanceof Error ? error.message : "Failed to fetch the simulation status.",
    };
  }
}

export default async function SimulationPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.sessionId;

  if (!sessionId) {
    return (
      <main className="simulation-page">
        <div className="empty-state-card">
          <p className="eyebrow">NO SESSION</p>
          <h1>No simulation session was provided.</h1>
          <p>Start from the landing page so the control service can create a valid Unity session.</p>
          <Link href="/" className="inline-link">
            Return to landing page
          </Link>
        </div>
      </main>
    );
  }

  const { status, errorMessage } = await getInitialStatus(sessionId);

  return (
    <main className="simulation-page">
      <header className="simulation-header">
        <div>
          <p className="eyebrow">AUTONOMOUS DRIVING TRAINER</p>
          <h1>Simulation Stream</h1>
        </div>
        <Link href="/" className="inline-link">
          Back to landing
        </Link>
      </header>
      <SimulationClient
        sessionId={sessionId}
        initialStatus={status}
        initialErrorMessage={errorMessage}
      />
    </main>
  );
}
