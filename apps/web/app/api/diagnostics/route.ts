import { NextResponse } from "next/server";

const controlApiBase =
  process.env.NEXT_PUBLIC_CONTROL_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:4000";
const signalingBase = "http://127.0.0.1:8080";

async function checkEndpoint(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET() {
  const [controlApi, signalingServer] = await Promise.all([
    checkEndpoint(`${controlApiBase}/health`),
    checkEndpoint(`${signalingBase}/config`),
  ]);

  return NextResponse.json({ controlApi, signalingServer });
}
