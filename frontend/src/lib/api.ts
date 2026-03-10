import type { ScanResult, GraphData } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchScan(domainId: number): Promise<ScanResult> {
  const res = await fetch(`${API_BASE}/api/v1/scan/${domainId}`);
  if (!res.ok) throw new Error(`Scan failed: ${res.status}`);
  return res.json();
}

export async function fetchGraph(domainId: number): Promise<GraphData> {
  const res = await fetch(`${API_BASE}/api/v1/graph/${domainId}`);
  if (!res.ok) throw new Error(`Graph failed: ${res.status}`);
  return res.json();
}

export async function fetchHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/health`);
    return res.ok;
  } catch {
    return false;
  }
}
