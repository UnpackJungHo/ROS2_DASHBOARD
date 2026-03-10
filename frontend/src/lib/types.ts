export interface TopicInfo {
  name: string;
  type: string;
  publishers: number;
  subscribers: number;
  hz: number | null;
}

export interface ServiceInfo {
  name: string;
  type: string;
  available: boolean;
}

export interface ActionInfo {
  name: string;
  type: string;
}

export interface NodeInfo {
  name: string;
  namespace: string;
}

export interface ScanResult {
  domain_id: number;
  timestamp: string;
  topics: TopicInfo[];
  services: ServiceInfo[];
  actions: ActionInfo[];
  nodes: NodeInfo[];
}

export interface GraphNode {
  id: string;
  namespace: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  topic: string;
  type: string;
}

export interface GraphTopicInfo {
  name: string;
  type: string;
  publishers: string[];   // node IDs
  subscribers: string[];  // node IDs
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];          // nn_edges (kept for compatibility)
  topics: GraphTopicInfo[];    // raw topic data for rqt_graph-style filtering
}

export type DisplayMode = "nodes_only" | "topics_all" | "topics_active";

export interface GraphFilters {
  displayMode: DisplayMode;
  // Show
  showNamespaces: boolean;
  showActions: boolean;
  showTf: boolean;
  showImages: boolean;
  // Hide
  hideDeadSinks: boolean;
  hideLeafTopics: boolean;
  hideDebug: boolean;
  hideTf: boolean;
  hideUnreachable: boolean;
  hideParams: boolean;
}

// Defaults match rqt_graph's default settings (all Hide checked)
export const DEFAULT_FILTERS: GraphFilters = {
  displayMode: "nodes_only",
  showNamespaces: true,
  showActions: true,
  showTf: true,
  showImages: true,
  hideDeadSinks: true,
  hideLeafTopics: true,
  hideDebug: true,
  hideTf: true,
  hideUnreachable: true,
  hideParams: true,
};
