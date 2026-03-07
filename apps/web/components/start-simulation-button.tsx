"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startSession } from "@/lib/control-api";

export function StartSimulationButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (isLoading || isPending) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const session = await startSession();
      startTransition(() => {
        router.push(`/simulation?sessionId=${session.sessionId}`);
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start the Unity session.",
      );
      setIsLoading(false);
    }
  };

  const busy = isLoading || isPending;

  return (
    <div className="cta-block">
      <button
        type="button"
        className="primary-button"
        onClick={handleClick}
        disabled={busy}
      >
        {busy ? "STARTING…" : "START SIMULATION"}
        <span className="btn-icon" aria-hidden="true">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3.5 2L7.5 5L3.5 8"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
    </div>
  );
}
