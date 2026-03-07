import { NextResponse } from "next/server";

const controlApiBaseUrl =
  process.env.NEXT_PUBLIC_CONTROL_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";

function buildErrorRedirect(request: Request, message: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, 303);
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/", request.url), 303);
}

export async function POST(request: Request) {
  try {
    const response = await fetch(`${controlApiBaseUrl}/api/sessions/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestedBy: "web-form" }),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      return buildErrorRedirect(request, text || "Failed to start the Unity session.");
    }

    const session = (await response.json()) as { sessionId?: string };
    if (!session.sessionId) {
      return buildErrorRedirect(request, "Control service did not return a sessionId.");
    }

    return NextResponse.redirect(
      new URL(`/simulation?sessionId=${session.sessionId}`, request.url),
      303,
    );
  } catch (error) {
    return buildErrorRedirect(
      request,
      error instanceof Error ? error.message : "Failed to start the Unity session.",
    );
  }
}
