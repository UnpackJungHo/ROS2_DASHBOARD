"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, useReactFlow,
  Handle, Position,
  reconnectEdge,
  type Node, type Edge, type NodeMouseHandler, type NodeProps, type Connection,
  MarkerType, Panel, ConnectionMode, SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import type { GraphData, GraphFilters, DisplayMode } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";
import { applyGraphFilters } from "@/lib/graph-filters";

// ── Layout ────────────────────────────────────────────────────────────────
const NODE_MIN_WIDTH = 140;
const NODE_HEIGHT = 40;
const TOPIC_NODE_HEIGHT = 32;
const NS_PADDING = 18;
const NS_LABEL_H = 22;

function calcNodeWidth(label: string) {
  return Math.max(NODE_MIN_WIDTH, label.length * 8 + 32);
}

function getLayoutedElements(nodes: Node[], edges: Edge[], dir: "LR" | "TB" = "LR") {
  // Dagre places disconnected nodes at the same position.
  // Split into connected and isolated, lay out connected with dagre,
  // then grid-place isolated nodes below.
  const connectedIds = new Set<string>();
  edges.forEach((e) => { connectedIds.add(e.source); connectedIds.add(e.target); });

  const connected = nodes.filter((n) => connectedIds.has(n.id));
  const isolated = nodes.filter((n) => !connectedIds.has(n.id));

  let layoutedConnected: Node[] = [];
  let maxY = 0;

  if (connected.length > 0) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: dir, nodesep: 50, ranksep: 100, edgesep: 20, marginx: 20, marginy: 20 });
    connected.forEach((n) => {
      g.setNode(n.id, {
        width: (n.style?.width as number) || NODE_MIN_WIDTH,
        height: (n.style?.height as number) || NODE_HEIGHT,
      });
    });
    edges.forEach((e) => g.setEdge(e.source, e.target));
    dagre.layout(g);
    layoutedConnected = connected.map((n) => {
      const pos = g.node(n.id);
      const w = (n.style?.width as number) || NODE_MIN_WIDTH;
      const h = (n.style?.height as number) || NODE_HEIGHT;
      const y = pos.y - h / 2;
      if (y + h > maxY) maxY = y + h;
      return { ...n, position: { x: pos.x - w / 2, y } };
    });
  }

  // Grid layout for isolated nodes
  const COLS = 3;
  const COL_W = 320;
  const ROW_H = 70;
  const START_Y = connected.length > 0 ? maxY + 60 : 0;

  const layoutedIsolated = isolated.map((n, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return { ...n, position: { x: col * COL_W, y: START_Y + row * ROW_H } };
  });

  return { nodes: [...layoutedConnected, ...layoutedIsolated], edges };
}

// ── Namespace group boxes ─────────────────────────────────────────────────

/** Returns all nodes (real + inner group boxes) that belong inside a group box. */
function getGroupContents(
  nodes: Node[],
  groupId: string,
  originalNodes: { id: string; namespace: string }[],
): Node[] {
  const ns = groupId.replace("__group__", "");
  const nsMap = new Map(originalNodes.map((n) => [n.id, n.namespace]));
  return nodes.filter((n) => {
    if (n.id === groupId) return false;
    if (n.id.startsWith("__group__")) {
      // inner group box: its namespace is a sub-namespace of ns
      return n.id.replace("__group__", "").startsWith(ns + "/");
    }
    if (n.id.startsWith("__topic__")) {
      return n.id.replace("__topic__", "").startsWith(ns + "/");
    }
    const nodeNs = nsMap.get(n.id) || "/";
    return nodeNs === ns || nodeNs.startsWith(ns + "/");
  });
}

function calcNamespaceBoxes(
  positionedNodes: Node[],
  originalNodes: { id: string; namespace: string }[],
): Node[] {
  const nsMap = new Map(originalNodes.map((n) => [n.id, n.namespace]));
  // depth → raw bounding box of all leaf nodes under that namespace
  const groups = new Map<string, { minX: number; minY: number; maxX: number; maxY: number; depth: number }>();

  const expand = (ns: string, depth: number, x: number, y: number, w: number, h: number) => {
    const b = groups.get(ns);
    if (b) {
      b.minX = Math.min(b.minX, x);
      b.minY = Math.min(b.minY, y);
      b.maxX = Math.max(b.maxX, x + w);
      b.maxY = Math.max(b.maxY, y + h);
    } else {
      groups.set(ns, { minX: x, minY: y, maxX: x + w, maxY: y + h, depth });
    }
  };

  for (const n of positionedNodes) {
    if (n.id.startsWith("__group__")) continue;
    const w = (n.style?.width as number) || NODE_MIN_WIDTH;
    const h = (n.style?.height as number) || NODE_HEIGHT;
    const { x, y } = n.position;

    if (n.id.startsWith("__topic__")) {
      // Topic /amr0/stop_line/perception → ancestors: /amr0/stop_line (depth 2), /amr0 (depth 1)
      const parts = n.id.replace("__topic__", "").split("/").filter(Boolean);
      for (let i = parts.length - 1; i >= 1; i--) {
        expand("/" + parts.slice(0, i).join("/"), i, x, y, w, h);
      }
    } else {
      // Regular node with namespace /amr0 → ancestors: /amr0 (depth 1)
      const ns = nsMap.get(n.id) || "/";
      if (!ns || ns === "/") continue;
      const parts = ns.split("/").filter(Boolean);
      for (let i = parts.length; i >= 1; i--) {
        expand("/" + parts.slice(0, i).join("/"), i, x, y, w, h);
      }
    }
  }

  if (groups.size === 0) return [];

  const maxDepth = Math.max(...Array.from(groups.values()).map((b) => b.depth));

  return Array.from(groups.entries()).map(([ns, b]) => {
    // Outer boxes get extra padding so their borders clear inner boxes' labels
    const extraLevels = maxDepth - b.depth;
    const pad = NS_PADDING + extraLevels * (NS_PADDING + NS_LABEL_H);
    return {
      id: `__group__${ns}`,
      type: "namespaceBg" as const,
      data: { label: ns },
      position: {
        x: b.minX - pad,
        y: b.minY - pad - NS_LABEL_H,
      },
      style: {
        width: b.maxX - b.minX + pad * 2,
        height: b.maxY - b.minY + pad * 2 + NS_LABEL_H,
        background: "transparent",
        border: "none",
        boxShadow: "none",
        padding: 0,
      },
      // Deeper namespaces render in front (closer to nodes), outer behind
      zIndex: -10 + b.depth,
      selectable: false,
      draggable: true,
      focusable: false,
      deletable: false,
    };
  });
}

const NamespaceBgNode = ({ data }: NodeProps) => (
  <div
    style={{
      width: "100%", height: "100%",
      border: "1px solid #334155",
      borderRadius: "8px",
      background: "rgba(15,23,42,0.45)",
      position: "relative",
      cursor: "grab",
    }}
  >
    <span style={{
      position: "absolute", top: 5, left: 10,
      fontSize: 10, color: "#64748b",
      fontFamily: "monospace", userSelect: "none",
    }}>
      {data.label as string}
    </span>
  </div>
);

const HANDLE_BASE: React.CSSProperties = {
  width: 8, height: 8, borderRadius: "50%",
  border: "1px solid #475569", background: "#1e293b",
  transition: "background 0.15s",
};
const HANDLE_TOPIC_BASE: React.CSSProperties = {
  ...HANDLE_BASE, border: "1px solid #166534", background: "#0f2417",
};

const RosNodeComponent = ({ data }: NodeProps) => (
  <>
    <Handle type="source" position={Position.Top}    id="t" style={HANDLE_BASE} />
    <Handle type="source" position={Position.Right}  id="r" style={HANDLE_BASE} />
    <Handle type="source" position={Position.Bottom} id="b" style={HANDLE_BASE} />
    <Handle type="source" position={Position.Left}   id="l" style={HANDLE_BASE} />
    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {data.label as string}
    </div>
  </>
);

const RosTopicNodeComponent = ({ data }: NodeProps) => (
  <>
    <Handle type="source" position={Position.Top}    id="t" style={HANDLE_TOPIC_BASE} />
    <Handle type="source" position={Position.Right}  id="r" style={HANDLE_TOPIC_BASE} />
    <Handle type="source" position={Position.Bottom} id="b" style={HANDLE_TOPIC_BASE} />
    <Handle type="source" position={Position.Left}   id="l" style={HANDLE_TOPIC_BASE} />
    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {data.label as string}
    </div>
  </>
);

const NODE_TYPES = {
  namespaceBg: NamespaceBgNode,
  rosNode: RosNodeComponent,
  rosTopic: RosTopicNodeComponent,
};

// ── Persistence ───────────────────────────────────────────────────────────
const POS_KEY = "ros2-graph-positions";
const FILTER_KEY = "ros2-graph-filters";

// posKey = JSON-stringified sorted visible node IDs — unique per filter combo
const savePositions = (domainId: number, posKey: string, nodes: Node[]) => {
  try {
    const real = nodes.filter((n) => !n.id.startsWith("__group__"));
    const all = JSON.parse(localStorage.getItem(POS_KEY) || "{}");
    if (!all[domainId]) all[domainId] = {};
    all[domainId][posKey] = Object.fromEntries(real.map((n) => [n.id, n.position]));
    localStorage.setItem(POS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
};

const loadPositions = (
  domainId: number,
  posKey: string,
): Record<string, { x: number; y: number }> | null => {
  try { return JSON.parse(localStorage.getItem(POS_KEY) || "{}")?.[domainId]?.[posKey] ?? null; }
  catch { return null; }
};

const saveFilters = (f: GraphFilters) => {
  try { localStorage.setItem(FILTER_KEY, JSON.stringify(f)); } catch { /* ignore */ }
};

const loadFilters = (): GraphFilters => {
  try { return { ...DEFAULT_FILTERS, ...JSON.parse(localStorage.getItem(FILTER_KEY) || "{}") }; }
  catch { return DEFAULT_FILTERS; }
};

// ── Styles ────────────────────────────────────────────────────────────────
const nodeStyle = (focused: boolean, width: number): React.CSSProperties => ({
  background: focused ? "#1e3a5f" : "#1e293b",
  color: "#e2e8f0",
  border: focused ? "2px solid #60a5fa" : "1px solid #475569",
  boxShadow: focused ? "0 0 14px rgba(96,165,250,0.45)" : "none",
  borderRadius: "8px", padding: "8px 16px",
  fontSize: "12px", fontFamily: "monospace",
  display: "flex", alignItems: "center",
  width, overflow: "hidden",
});

const topicStyle = (focused: boolean, width: number): React.CSSProperties => ({
  background: focused ? "#1a3a2a" : "#0f2417",
  color: "#86efac",
  border: focused ? "2px solid #4ade80" : "1px solid #166534",
  boxShadow: focused ? "0 0 12px rgba(74,222,128,0.4)" : "none",
  borderRadius: "6px", padding: "5px 12px",
  fontSize: "11px", fontFamily: "monospace",
  display: "flex", alignItems: "center",
  width, overflow: "hidden",
});

// ── FlowInternals — must live inside ReactFlow context ───────────────────
interface FlowAPI {
  setCenter: (x: number, y: number, opts?: { zoom?: number; duration?: number }) => void;
  getViewport: () => { x: number; y: number; zoom: number };
}
function FlowInternals({ apiRef }: { apiRef: React.MutableRefObject<FlowAPI | null> }) {
  const { setCenter, getViewport } = useReactFlow();
  apiRef.current = { setCenter, getViewport };
  return null;
}

// ── FilterBar ─────────────────────────────────────────────────────────────
function FilterBar({
  filters, onChange, onRefresh, refreshing,
}: {
  filters: GraphFilters;
  onChange: (f: GraphFilters) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const set = (patch: Partial<GraphFilters>) => {
    const next = { ...filters, ...patch };
    onChange(next);
    saveFilters(next);
  };

  const CB = ({ label, checked, onToggle, yellow = false }: {
    label: string; checked: boolean; onToggle: () => void; yellow?: boolean;
  }) => (
    <button
      onClick={onToggle}
      className={[
        "flex items-center gap-1 px-2 py-0.5 rounded border text-xs transition-colors",
        checked
          ? yellow
            ? "text-yellow-300 border-yellow-700 bg-yellow-900/30"
            : "text-blue-300 border-blue-600 bg-blue-900/30"
          : "text-gray-500 border-gray-700 hover:border-gray-500",
      ].join(" ")}
    >
      <span className={[
        "w-3 h-3 rounded-sm border flex items-center justify-center text-[9px]",
        checked ? "border-current bg-current/20" : "border-gray-600",
      ].join(" ")}>
        {checked ? "✓" : ""}
      </span>
      {label}
    </button>
  );

  return (
    <div className="px-4 py-2 border-b border-gray-700 shrink-0 space-y-1.5">
      {/* Row 1: display mode + Show options + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Refresh button */}
        <button
          onClick={onRefresh}
          title="Refresh graph"
          className="flex items-center justify-center w-7 h-7 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 text-gray-300 ${refreshing ? "animate-spin" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <select
          value={filters.displayMode}
          onChange={(e) => set({ displayMode: e.target.value as DisplayMode })}
          className="px-2 py-1 bg-gray-800 border border-gray-600 text-white text-xs rounded focus:outline-none focus:border-blue-500"
        >
          <option value="nodes_only">Nodes only</option>
          <option value="topics_active">Nodes/Topics (active)</option>
          <option value="topics_all">Nodes/Topics (all)</option>
        </select>

        <span className="text-xs text-gray-500">Show:</span>
        <CB label="Namespaces" checked={filters.showNamespaces} onToggle={() => set({ showNamespaces: !filters.showNamespaces })} />
        <CB label="Actions"    checked={filters.showActions}    onToggle={() => set({ showActions: !filters.showActions })} />
        <CB label="tf"         checked={filters.showTf}         onToggle={() => set({ showTf: !filters.showTf })} />
        <CB label="Images"     checked={filters.showImages}     onToggle={() => set({ showImages: !filters.showImages })} />
      </div>

      {/* Row 2: Hide options */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-gray-500">Hide:</span>
        <CB label="Dead sinks"  checked={filters.hideDeadSinks}   onToggle={() => set({ hideDeadSinks: !filters.hideDeadSinks })}   yellow />
        <CB label="Leaf topics" checked={filters.hideLeafTopics}  onToggle={() => set({ hideLeafTopics: !filters.hideLeafTopics })} yellow />
        <CB label="Debug"       checked={filters.hideDebug}       onToggle={() => set({ hideDebug: !filters.hideDebug })}           yellow />
        <CB label="tf"          checked={filters.hideTf}          onToggle={() => set({ hideTf: !filters.hideTf })}                 yellow />
        <CB label="Unreachable" checked={filters.hideUnreachable} onToggle={() => set({ hideUnreachable: !filters.hideUnreachable })} yellow />
        <CB label="Params"      checked={filters.hideParams}      onToggle={() => set({ hideParams: !filters.hideParams })}         yellow />
        <button
          onClick={() => { onChange(DEFAULT_FILTERS); saveFilters(DEFAULT_FILTERS); }}
          className="ml-1 px-2 py-0.5 text-xs text-gray-500 hover:text-white border border-gray-700 hover:border-gray-500 rounded transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ── NodeSearch — google-style dropdown ────────────────────────────────────
function NodeSearch({
  allNodeIds,
  visibleNodeIds,
  focusedNodeId,
  onSelect,
}: {
  allNodeIds: string[];
  visibleNodeIds: Set<string>;
  focusedNodeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as EventTarget & globalThis.Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return allNodeIds
      .filter((id) => id.toLowerCase().includes(q))
      .slice(0, 12); // max 12 results
  }, [allNodeIds, query]);

  const handleSelect = (id: string) => {
    onSelect(id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={query}
          placeholder="Search / focus node..."
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setQuery(""); }
            if (e.key === "Enter" && results.length > 0) handleSelect(results[0]);
          }}
          className="w-full pl-8 pr-8 py-1.5 bg-gray-800 border border-gray-600 rounded text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-xl z-50 overflow-hidden">
          {results.map((id) => {
            const label = id.split("/").pop() || id;
            const visible = visibleNodeIds.has(id);
            const focused = focusedNodeId === id;
            return (
              <button
                key={id}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(id); }}
                className={[
                  "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-700 transition-colors",
                  focused ? "bg-blue-900/30" : "",
                ].join(" ")}
              >
                {/* Color dot: blue=visible+focused, cyan=visible, gray=filtered */}
                <span className={[
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  focused ? "bg-blue-400" : visible ? "bg-cyan-500" : "bg-gray-600",
                ].join(" ")} />
                <span className={[
                  "font-mono text-xs truncate",
                  visible ? "text-white" : "text-gray-500",
                ].join(" ")}>
                  {label}
                </span>
                {/* Full path hint */}
                <span className="font-mono text-xs text-gray-600 truncate ml-auto shrink-0 max-w-[160px]">
                  {id}
                </span>
                {!visible && (
                  <span className="text-xs text-yellow-600 shrink-0">filtered</span>
                )}
                {focused && (
                  <span className="text-xs text-blue-400 shrink-0">⦿</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {open && query.trim() && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-xl z-50 px-3 py-2">
          <span className="text-xs text-gray-500">No nodes match &quot;{query}&quot;</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
interface NodeGraphProps {
  data: GraphData | null;
  domainId: number;
  onRefresh: () => void;
}

export default function NodeGraph({ data, domainId, onRefresh }: NodeGraphProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [filters, setFilters] = useState<GraphFilters>(loadFilters);
  const [refreshing, setRefreshing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const flowApiRef = useRef<FlowAPI | null>(null);
  const prevVisibleKey = useRef("");
  const initialized = useRef(false);
  // Persist manual edge handle overrides across data refreshes (keyed by stable edge ID)
  const edgeHandleOverrides = useRef(new Map<string, { sourceHandle: string; targetHandle: string }>());
  // Track group-box drag state: start positions of box + all contained nodes
  const groupDragRef = useRef<{
    groupId: string;
    startPos: { x: number; y: number };
    startPositions: Map<string, { x: number; y: number }>;
  } | null>(null);

  // Reset on domain change
  useEffect(() => {
    setFocusedNodeId(null);
    prevVisibleKey.current = "";
    initialized.current = false;
    edgeHandleOverrides.current.clear();
  }, [domainId]);

  // Manual refresh with brief spin animation
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    onRefresh();
    setTimeout(() => setRefreshing(false), 800);
  }, [onRefresh]);

  // Apply filters
  const filtered = useMemo(
    () => (data ? applyGraphFilters(data, filters, new Set()) : { nodes: [], edges: [] }),
    [data, filters]
  );

  const allNodeIds = useMemo(() => data?.nodes.map((n) => n.id) ?? [], [data]);

  // Viewport center
  const getViewportCenter = useCallback(() => {
    if (!containerRef.current || !flowApiRef.current) return { x: 200, y: 200 };
    const { x: vpX, y: vpY, zoom } = flowApiRef.current.getViewport();
    const rect = containerRef.current.getBoundingClientRect();
    return { x: (-vpX + rect.width / 2) / zoom, y: (-vpY + rect.height / 2) / zoom };
  }, []);

  // Build flow nodes
  const flowNodes = useMemo(() => filtered.nodes.map((n) => {
    const isTopic = n.id.startsWith("__topic__");
    const label = isTopic
      ? n.id.replace("__topic__", "")
      : n.id.split("/").pop() || n.id;
    const focused = focusedNodeId === n.id;
    const width = calcNodeWidth(label);
    return {
      id: n.id,
      type: isTopic ? "rosTopic" : "rosNode",
      data: { label, fullName: n.id, namespace: n.namespace },
      position: { x: 0, y: 0 },
      style: isTopic
        ? { ...topicStyle(focused, width), height: TOPIC_NODE_HEIGHT }
        : nodeStyle(focused, width),
    };
  }), [filtered.nodes, focusedNodeId]);

  const visibleNodeIds = useMemo(() => new Set(flowNodes.map((n) => n.id)), [flowNodes]);

  const flowEdges = useMemo(() => filtered.edges
    .filter((e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
    .map((e) => {
      // Stable ID (no index) so overrides survive data refreshes
      const id = `e||${e.source}||${e.target}||${e.topic}`;
      const override = edgeHandleOverrides.current.get(id);
      const hovered = hoveredEdge === id;
      const isTopic = e.source.startsWith("__topic__") || e.target.startsWith("__topic__");
      return {
        id, source: e.source, target: e.target,
        sourceHandle: override?.sourceHandle ?? "r",
        targetHandle: override?.targetHandle ?? "l",
        reconnectable: true,
        label: isTopic ? undefined : e.topic.split("/").pop(),
        data: { topic: e.topic, type: e.type },
        type: "smoothstep", animated: !isTopic,
        style: {
          stroke: hovered ? "#60a5fa" : isTopic ? "#166534" : "#64748b",
          strokeWidth: hovered ? 2.5 : 1.5,
        },
        labelStyle: { fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" },
        labelBgStyle: { fill: "#0f172a", fillOpacity: 0.8 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: hovered ? "#60a5fa" : isTopic ? "#166534" : "#64748b",
          width: 14, height: 14,
        },
      };
    }), [filtered.edges, hoveredEdge, visibleNodeIds]);

  // positionKey: node IDs only (no ns suffix) — same nodes = same saved layout regardless of ns visibility
  const positionKey = useMemo(
    () => JSON.stringify([...visibleNodeIds].sort()),
    [visibleNodeIds],
  );

  // visibleKey: includes ns flag so toggling namespace boxes triggers a layout re-check
  const visibleKey = useMemo(
    () => positionKey + "|ns:" + filters.showNamespaces,
    [positionKey, filters.showNamespaces],
  );

  // Layout effect
  useEffect(() => {
    if (flowNodes.length === 0) { setNodes([]); setEdges(flowEdges); return; }
    if (visibleKey === prevVisibleKey.current) return;
    prevVisibleKey.current = visibleKey;

    const saved = loadPositions(domainId, positionKey);
    let finalNodes: Node[];

    if (saved && flowNodes.every((n) => saved[n.id])) {
      finalNodes = flowNodes.map((n) => ({ ...n, position: saved[n.id] }));
    } else {
      const { nodes: ln } = getLayoutedElements(flowNodes, flowEdges);
      finalNodes = ln;
    }

    finalNodes = finalNodes.map((n) => {
      const isTopic = n.id.startsWith("__topic__");
      const focused = n.id === focusedNodeId;
      return {
        ...n,
        style: isTopic
          ? { ...topicStyle(focused, (n.style?.width as number) || NODE_MIN_WIDTH), height: TOPIC_NODE_HEIGHT, width: n.style?.width }
          : { ...nodeStyle(focused, (n.style?.width as number) || NODE_MIN_WIDTH), width: n.style?.width },
      };
    });

    const groupFrames = filters.showNamespaces
      ? calcNamespaceBoxes(finalNodes, filtered.nodes)
      : [];
    setNodes([...groupFrames, ...finalNodes]);
    setEdges(flowEdges);
    initialized.current = true;
  }, [visibleKey, positionKey, flowNodes, flowEdges, domainId, focusedNodeId, filters.showNamespaces, filtered.nodes, setNodes, setEdges]);

  // Focus style only
  useEffect(() => {
    if (!initialized.current) return;
    setNodes((prev) => prev.map((n) => {
      if (n.id.startsWith("__group__")) return n;
      const isTopic = n.id.startsWith("__topic__");
      const focused = n.id === focusedNodeId;
      return {
        ...n,
        style: isTopic
          ? { ...topicStyle(focused, (n.style?.width as number) || NODE_MIN_WIDTH), height: TOPIC_NODE_HEIGHT, width: n.style?.width }
          : { ...nodeStyle(focused, (n.style?.width as number) || NODE_MIN_WIDTH), width: n.style?.width },
      };
    }));
  }, [focusedNodeId, setNodes]);

  // Edge hover
  useEffect(() => {
    if (initialized.current) setEdges(flowEdges);
  }, [hoveredEdge, flowEdges, setEdges]);

  // Search/focus handler
  const handleNodeSelect = useCallback((id: string) => {
    setFocusedNodeId(id);
    const target = nodes.find((n) => n.id === id);
    if (target && flowApiRef.current) {
      const w = (target.style?.width as number) || NODE_MIN_WIDTH;
      const h = (target.style?.height as number) || NODE_HEIGHT;
      flowApiRef.current.setCenter(
        target.position.x + w / 2,
        target.position.y + h / 2,
        { zoom: 1.2, duration: 600 },
      );
    }
  }, [nodes]);

  const onAutoLayout = useCallback(() => {
    const realNodes = nodes.filter((n) => !n.id.startsWith("__group__"));
    const { nodes: ln, edges: le } = getLayoutedElements(realNodes, edges);
    const groupFrames = filters.showNamespaces
      ? calcNamespaceBoxes(ln, filtered.nodes)
      : [];
    setNodes([...groupFrames, ...ln]);
    setEdges(le);
    savePositions(domainId, positionKey, ln); // auto-save so this layout is restored on filter toggle
  }, [nodes, edges, domainId, positionKey, filters.showNamespaces, filtered.nodes, setNodes, setEdges]);

  const onSaveLayout = useCallback(
    () => savePositions(domainId, positionKey, nodes),
    [domainId, positionKey, nodes],
  );

  // Group-box drag: record start positions of box + all contained nodes
  const onNodeDragStart: NodeMouseHandler = useCallback((_e, draggedNode) => {
    if (!draggedNode.id.startsWith("__group__")) return;
    const contents = getGroupContents(nodes, draggedNode.id, filtered.nodes);
    const startPositions = new Map<string, { x: number; y: number }>(
      [...contents, draggedNode].map((n) => [n.id, { ...n.position }]),
    );
    groupDragRef.current = {
      groupId: draggedNode.id,
      startPos: { ...draggedNode.position },
      startPositions,
    };
  }, [nodes, filtered.nodes]);

  // Group-box drag: move all contained nodes by the same delta as the box
  const onNodeDrag: NodeMouseHandler = useCallback((_e, draggedNode) => {
    if (!draggedNode.id.startsWith("__group__")) return;
    const drag = groupDragRef.current;
    if (!drag || drag.groupId !== draggedNode.id) return;
    const dx = draggedNode.position.x - drag.startPos.x;
    const dy = draggedNode.position.y - drag.startPos.y;
    // Capture ref value before entering async setNodes callback
    const { startPositions } = drag;
    setNodes((prev) => prev.map((n) => {
      if (n.id === draggedNode.id) return n; // React Flow moves the box itself
      const start = startPositions.get(n.id);
      if (!start) return n;
      return { ...n, position: { x: start.x + dx, y: start.y + dy } };
    }));
  }, [setNodes]);

  const onNodeDragStop: NodeMouseHandler = useCallback((_e, draggedNode) => {
    groupDragRef.current = null;
    setNodes((prev) => {
      const realNodes = prev.filter((n) => !n.id.startsWith("__group__"));
      savePositions(domainId, positionKey, realNodes);
      if (filters.showNamespaces) {
        const groupFrames = calcNamespaceBoxes(realNodes, filtered.nodes);
        return [...groupFrames, ...realNodes];
      }
      return realNodes;
    });
  }, [domainId, positionKey, filters.showNamespaces, filtered.nodes, setNodes]);
  // ① Drag an edge endpoint → update that edge's handle IDs
  const onReconnect = useCallback((oldEdge: Edge, newConn: Connection) => {
    const sh = newConn.sourceHandle || "r";
    const th = newConn.targetHandle || "l";
    edgeHandleOverrides.current.set(oldEdge.id, { sourceHandle: sh, targetHandle: th });
    setEdges((eds) => reconnectEdge(oldEdge, newConn, eds));
  }, [setEdges]);

  // ② Drag FROM a node Handle → find existing edge between those nodes and update its handles
  // (instead of creating a new duplicate edge)
  const onConnect = useCallback((connection: Connection) => {
    const existing = edges.find((e) =>
      (e.source === connection.source && e.target === connection.target) ||
      (e.source === connection.target && e.target === connection.source),
    );
    if (!existing) return; // no existing edge — don't create new edges
    const sameDir = existing.source === connection.source;
    const newSH = (sameDir ? connection.sourceHandle : connection.targetHandle) || "r";
    const newTH = (sameDir ? connection.targetHandle : connection.sourceHandle) || "l";
    edgeHandleOverrides.current.set(existing.id, { sourceHandle: newSH, targetHandle: newTH });
    setEdges((eds) => eds.map((e) =>
      e.id !== existing.id ? e : { ...e, sourceHandle: newSH, targetHandle: newTH },
    ));
  }, [edges, setEdges]);

  const onEdgeMouseEnter = useCallback((_e: React.MouseEvent, edge: Edge) => setHoveredEdge(edge.id), []);
  const onEdgeMouseLeave = useCallback(() => setHoveredEdge(null), []);
  const hoveredEdgeData = useMemo(() => edges.find((e) => e.id === hoveredEdge), [edges, hoveredEdge]);

  const visibleRealCount = filtered.nodes.filter((n) => !n.id.startsWith("__topic__")).length;
  const totalCount = allNodeIds.length;

  if (!data) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm">No graph data. Connect to a domain.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Node Graph</h2>
        <div className="flex items-center gap-3">
          {hoveredEdgeData && (
            <span className="text-xs text-blue-300 font-mono truncate max-w-xs">
              {String(hoveredEdgeData.data?.topic ?? "")}
            </span>
          )}
          <span className="text-xs text-gray-500">{visibleRealCount}/{totalCount} nodes</span>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} onRefresh={handleRefresh} refreshing={refreshing} />

      {/* Search bar */}
      <div className="px-4 py-2.5 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-sm">
            <NodeSearch
              allNodeIds={allNodeIds}
              visibleNodeIds={visibleNodeIds}
              focusedNodeId={focusedNodeId}
              onSelect={handleNodeSelect}
            />
          </div>
          {focusedNodeId && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-blue-400 font-mono bg-blue-900/30 border border-blue-700 px-2 py-0.5 rounded">
                ⦿ {focusedNodeId.split("/").pop()}
              </span>
              <button
                onClick={() => setFocusedNodeId(null)}
                className="text-gray-500 hover:text-white text-xs"
                title="Clear focus"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Graph */}
      <div ref={containerRef} className="flex-1 min-h-[400px]">
        {visibleRealCount === 0 && totalCount > 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <p className="text-gray-400 text-sm">All {totalCount} nodes are filtered out.</p>
            <p className="text-gray-600 text-xs">
              Try disabling{" "}
              <span className="text-yellow-400">Hide: Unreachable</span> or{" "}
              <span className="text-yellow-400">Dead sinks</span>.
            </p>
            <button
              onClick={() => { setFilters(DEFAULT_FILTERS); saveFilters(DEFAULT_FILTERS); }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white text-xs rounded"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeDragStart={onNodeDragStart}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            onReconnect={onReconnect}
            onConnect={onConnect}
            onEdgeMouseEnter={onEdgeMouseEnter} onEdgeMouseLeave={onEdgeMouseLeave}
            nodeTypes={NODE_TYPES}
            connectionMode={ConnectionMode.Loose}
            panOnDrag={[1, 2]}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            fitView proOptions={{ hideAttribution: true }} colorMode="dark"
          >
            <FlowInternals apiRef={flowApiRef} />
            <Background color="#334155" gap={20} size={1} />
            <Controls showInteractive={false}
              className="!bg-gray-800 !border-gray-700 [&>button]:!bg-gray-800 [&>button]:!border-gray-700 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700" />
            <MiniMap nodeColor="#475569" maskColor="rgba(0,0,0,0.7)"
              className="!bg-gray-800 !border-gray-700" />
            <Panel position="top-right" className="flex gap-2">
              <button onClick={onAutoLayout}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white text-xs rounded">
                Auto Layout
              </button>
              <button onClick={onSaveLayout}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white text-xs rounded">
                Save Layout
              </button>
            </Panel>
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
