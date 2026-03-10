/**
 * rqt_graph-compatible filtering.
 *
 * Exact mapping to rqt_graph (dotcode.py + rosgraph2_impl.py):
 *
 *  hideDeadSinks  → hide_dead_end_topics:  remove TOPICS with no subscribers
 *                   (NOT nodes — rqt_graph always shows all nodes)
 *  hideLeafTopics → hide_single_connection_topics: remove topics with pub+sub < 2
 *  hideDebug      → quiet=True: hide /rosout /clock /statistics topics,
 *                   and node names in QUIET_NAMES or starting with '_'
 *  hideTf         → hide_tf_nodes=True: remove /tf, /tf_static topics
 *  hideUnreachable→ unreachable=True: rqt_graph hides "bad" nodes (DEAD/WONKY).
 *                   We approximate: hide nodes that appear in zero surviving topics.
 *  hideParams     → hide_dynamic_reconfigure=True: remove /parameter_events topics
 *
 * NODE_NODE_GRAPH mode (nodes_only):
 *   1. Filter nt_nodes (topic nodes) by all Hide rules
 *   2. nn_edges = direct pub→sub edges only for topics that survived (step 1)
 *   3. nt_nodes cleared (not shown)
 *   4. All nn_nodes (nodes with ≥1 topic) shown regardless of edge count
 *
 * NODE_TOPIC_ALL_GRAPH (topics_all):
 *   All edges from nt_all_edges for surviving topics
 *
 * NODE_TOPIC_GRAPH (topics_active):
 *   Only topics with at least one visible pub AND visible sub
 */

import type { GraphData, GraphFilters, GraphNode, GraphEdge } from "./types";

// ── Topic classifiers ──────────────────────────────────────────────────────
const TF_TOPICS = ["/tf", "/tf_static"];

// rqt_graph QUIET_NAMES (substrings to match in node names)
const QUIET_NODE_SUBSTRINGS = [
  "/rosout", "/clock", "/rqt", "/statistics",
  "/diag_agg", "/runtime_logger", "/pr2_dashboard", "/rviz",
  "/cpu_monitor", "/monitor", "/hd_monitor", "/rxloggerlevel",
];

// Topics hidden by quiet filter (exact match)
const QUIET_TOPICS = ["/rosout", "/clock", "/statistics", "/time"];

// Topics hidden by hide_dynamic_reconfigure (suffix match)
function isParamTopic(name: string) {
  return name === "/parameter_events" || name.endsWith("/parameter_events");
}

function isActionTopic(name: string) { return name.includes("/_action/"); }
function isTfTopic(name: string) { return TF_TOPICS.some((t) => name === t || name.startsWith(t + "/")); }
function isQuietTopic(name: string) { return QUIET_TOPICS.some((q) => name === q); }
function isQuietNode(id: string) {
  const lastName = id.split("/").pop() || "";
  if (lastName.startsWith("_")) return true;
  return QUIET_NODE_SUBSTRINGS.some((q) => id.includes(q));
}
function isImageType(type: string) {
  return type.includes("Image") || type.includes("CompressedImage");
}

export interface FilteredGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function applyGraphFilters(
  data: GraphData,
  filters: GraphFilters,
  hiddenNodes: Set<string>
): FilteredGraph {

  // ── Pass 1: Filter topics (nt_nodes) ───────────────────────────────────
  // Mirrors rqt_graph's nt_nodes → _filter_leaf_topics → _filter_hidden_topics
  const survivingTopics = data.topics.filter((t) => {
    // Show/hide by topic category
    if (!filters.showActions && isActionTopic(t.name)) return false;
    if (!filters.showTf && isTfTopic(t.name)) return false;
    if (!filters.showImages && isImageType(t.type)) return false;

    // hide_tf_nodes: removes /tf and /tf_static topic nodes
    if (filters.hideTf && isTfTopic(t.name)) return false;

    // quiet filter (hideDebug): removes /rosout /clock /statistics topics
    if (filters.hideDebug && isQuietTopic(t.name)) return false;

    // hide_dynamic_reconfigure (hideParams): removes /parameter_events topics
    if (filters.hideParams && isParamTopic(t.name)) return false;

    // hide_dead_end_topics (hideDeadSinks):
    // rqt_graph: removes topic nodes with NO outgoing edges (no subscribers)
    // i.e. topics that are "published but nobody reads"
    if (filters.hideDeadSinks && t.subscribers.length === 0) return false;

    // hide_single_connection_topics (hideLeafTopics):
    // rqt_graph: removes topic nodes with fewer than 2 total connections
    if (filters.hideLeafTopics && t.publishers.length + t.subscribers.length < 2) return false;

    return true;
  });

  // ── ALL topic connectivity (unfiltered) — for hideUnreachable ─────────
  // rqt_graph's nn_nodes = only nodes with ≥1 pub/sub for ANY topic.
  // hideUnreachable in rqt_graph = hides DEAD/WONKY nodes (bad RPC).
  // We approximate: hide nodes that have NO topic connection at all.
  const allConnectedIds = new Set<string>();
  for (const t of data.topics) {
    for (const id of t.publishers) allConnectedIds.add(id);
    for (const id of t.subscribers) allConnectedIds.add(id);
  }

  // ── Pass 2: Filter nodes (nn_nodes) ────────────────────────────────────
  const visibleNodes = data.nodes.filter((n) => {
    if (hiddenNodes.has(n.id)) return false;

    // quiet filter (hideDebug): removes /rosout, /rqt, nodes starting with _
    if (filters.hideDebug && isQuietNode(n.id)) return false;

    // unreachable: hide nodes with NO topic connections at all
    // (matches rqt_graph showing only nn_nodes = nodes with ≥1 topic)
    if (filters.hideUnreachable && !allConnectedIds.has(n.id)) return false;

    return true;
  });

  const visibleIds = new Set(visibleNodes.map((n) => n.id));

  // ── NODE_NODE_GRAPH mode: "Nodes only" ─────────────────────────────────
  // rqt_graph: edges = [e for e in nn_edges if topic_node(e.label) in nt_nodes]
  // i.e. only direct pub→sub edges whose connecting topic survived Pass 1.
  if (filters.displayMode === "nodes_only") {
    const survivingTopicNames = new Set(survivingTopics.map((t) => t.name));
    // Use nn_edges from backend, filtered to surviving topics
    const edges = data.edges.filter(
      (e) =>
        survivingTopicNames.has(e.topic) &&
        visibleIds.has(e.source) &&
        visibleIds.has(e.target)
    );
    return { nodes: visibleNodes, edges };
  }

  // ── NODE_TOPIC_ALL_GRAPH / NODE_TOPIC_GRAPH: topic nodes as intermediaries
  // rqt_graph: nt_all_edges = every pub→topic and topic→sub edge
  const topicNodes: GraphNode[] = [];
  const ntEdges: GraphEdge[] = [];

  for (const t of survivingTopics) {
    const hasPub = t.publishers.some((id) => visibleIds.has(id));
    const hasSub = t.subscribers.some((id) => visibleIds.has(id));

    // topics_active (NODE_TOPIC_GRAPH): skip topics without both visible pub AND sub
    if (filters.displayMode === "topics_active" && (!hasPub || !hasSub)) continue;
    // topics_all (NODE_TOPIC_ALL_GRAPH): skip only if no visible endpoints at all
    if (filters.displayMode === "topics_all" && !hasPub && !hasSub) continue;

    const topicNodeId = `__topic__${t.name}`;
    topicNodes.push({ id: topicNodeId, namespace: "/__topics__" });

    for (const pubId of t.publishers) {
      if (visibleIds.has(pubId)) {
        ntEdges.push({ source: pubId, target: topicNodeId, topic: t.name, type: t.type });
      }
    }
    for (const subId of t.subscribers) {
      if (visibleIds.has(subId)) {
        ntEdges.push({ source: topicNodeId, target: subId, topic: t.name, type: t.type });
      }
    }
  }

  return { nodes: [...visibleNodes, ...topicNodes], edges: ntEdges };
}
