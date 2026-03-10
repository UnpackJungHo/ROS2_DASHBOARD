"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { fetchScan, fetchGraph, fetchHealth } from "@/lib/api";
import type { ScanResult, GraphData } from "@/lib/types";

interface UseRosDataOptions {
  domainId: number | null;
  interval?: number;
}

interface UseRosDataReturn {
  scan: ScanResult | null;
  graph: GraphData | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useRosData({
  domainId,
  interval = 2000,
}: UseRosDataOptions): UseRosDataReturn {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doFetch = useCallback(async () => {
    if (domainId === null) return;

    try {
      setLoading(true);
      const [scanData, graphData] = await Promise.all([
        fetchScan(domainId),
        fetchGraph(domainId),
      ]);
      setScan(scanData);
      setGraph(graphData);
      setConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, [domainId]);

  // Health check on mount
  useEffect(() => {
    fetchHealth().then(setConnected);
  }, []);

  // Polling
  useEffect(() => {
    if (domainId === null) {
      setScan(null);
      setGraph(null);
      return;
    }

    doFetch();
    intervalRef.current = setInterval(doFetch, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [domainId, interval, doFetch]);

  // Pause polling when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else if (domainId !== null) {
        doFetch();
        intervalRef.current = setInterval(doFetch, interval);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [domainId, interval, doFetch]);

  return { scan, graph, connected, loading, error, refresh: doFetch };
}
