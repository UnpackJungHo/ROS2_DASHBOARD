"""
ROS2 Domain Scanner — rqt_graph compatible implementation.

Graph discovery follows the same approach as rqt_graph (rosgraph2_impl.py):
  1. get_topic_names_and_types()           → topic list
  2. get_publishers_info_by_topic(topic)   → TopicEndpointInfo per publisher
  3. get_subscriptions_info_by_topic(topic)→ TopicEndpointInfo per subscriber
  4. Build nn_edges as product(pub_nodes, sub_nodes) per topic
  5. Build GraphTopicInfo for frontend rqt_graph-style filtering
"""

import threading
import time
from collections import defaultdict

import rclpy
from rclpy.node import Node

from .models import (
    ActionInfo,
    GraphData,
    GraphEdge,
    GraphNode,
    GraphTopicInfo,
    NodeInfo,
    ScanResult,
    ServiceInfo,
    TopicInfo,
)


_SCANNER_PREFIX = "dashboard_scanner_"
_FILTERED_TOPICS = {"/rosout", "/parameter_events"}
_PARAM_SERVICE_SUFFIXES = (
    "/describe_parameters",
    "/get_parameter_types",
    "/get_parameters",
    "/get_type_description",
    "/list_parameters",
    "/set_parameters",
    "/set_parameters_atomically",
)


def _node_id(namespace: str, name: str) -> str:
    return f"{namespace.rstrip('/')}/{name}"


def _is_scanner(name: str) -> bool:
    return name.startswith(_SCANNER_PREFIX)


class ROS2DomainScanner:

    def __init__(self):
        self._nodes: dict[int, Node] = {}
        self._contexts: dict[int, rclpy.Context] = {}
        self._locks: dict[int, threading.Lock] = defaultdict(threading.Lock)
        self._last_access: dict[int, float] = {}

    # ── Node lifecycle ────────────────────────────────────────────────────

    def _get_node(self, domain_id: int) -> Node:
        if domain_id not in self._nodes:
            ctx = rclpy.Context()
            ctx.init(args=None, domain_id=domain_id)
            node = Node(
                f"{_SCANNER_PREFIX}{domain_id}",
                context=ctx,
                enable_rosout=False,
            )
            self._nodes[domain_id] = node
            self._contexts[domain_id] = ctx
            # Spin briefly so DDS discovery can propagate
            from rclpy.executors import SingleThreadedExecutor
            executor = SingleThreadedExecutor(context=ctx)
            executor.add_node(node)
            for _ in range(10):
                executor.spin_once(timeout_sec=0.1)
            executor.remove_node(node)
            executor.shutdown()
        self._last_access[domain_id] = time.time()
        return self._nodes[domain_id]

    def cleanup_stale(self, max_age: float = 60.0):
        now = time.time()
        for did in [d for d, t in self._last_access.items() if now - t > max_age]:
            self._destroy_node(did)

    def _destroy_node(self, domain_id: int):
        for store in (self._nodes, self._contexts):
            obj = store.pop(domain_id, None)
            if obj is None:
                continue
            try:
                obj.destroy_node() if hasattr(obj, "destroy_node") else obj.shutdown()
            except Exception:
                pass
        self._last_access.pop(domain_id, None)

    def shutdown(self):
        for did in list(self._nodes):
            self._destroy_node(did)

    # ── Scan helpers ──────────────────────────────────────────────────────

    def scan_topics(self, domain_id: int) -> list[TopicInfo]:
        with self._locks[domain_id]:
            node = self._get_node(domain_id)
            result = []
            for name, types in node.get_topic_names_and_types():
                if name in _FILTERED_TOPICS or "/_action/" in name:
                    continue
                result.append(TopicInfo(
                    name=name,
                    type=types[0] if types else "unknown",
                    publishers=node.count_publishers(name),
                    subscribers=node.count_subscribers(name),
                    hz=None,
                ))
            return result

    def scan_services(self, domain_id: int) -> list[ServiceInfo]:
        with self._locks[domain_id]:
            node = self._get_node(domain_id)
            result = []
            for name, types in node.get_service_names_and_types():
                if _SCANNER_PREFIX in name:
                    continue
                if "/_action/" in name:
                    continue
                if any(name.endswith(s) for s in _PARAM_SERVICE_SUFFIXES):
                    continue
                result.append(ServiceInfo(
                    name=name,
                    type=types[0] if types else "unknown",
                    available=True,
                ))
            return result

    def scan_actions(self, domain_id: int) -> list[ActionInfo]:
        with self._locks[domain_id]:
            node = self._get_node(domain_id)
            actions: dict[str, str] = {}
            for name, types in node.get_topic_names_and_types():
                if "/_action/feedback" in name:
                    aname = name.replace("/_action/feedback", "")
                    atype = (types[0] if types else "unknown").replace("_FeedbackMessage", "")
                    actions[aname] = atype
            return [ActionInfo(name=n, type=t) for n, t in sorted(actions.items())]

    def scan_nodes(self, domain_id: int) -> list[NodeInfo]:
        with self._locks[domain_id]:
            node = self._get_node(domain_id)
            seen: set[tuple[str, str]] = set()
            result = []
            for name, namespace in node.get_node_names_and_namespaces():
                if _is_scanner(name):
                    continue
                key = (name, namespace)
                if key not in seen:
                    seen.add(key)
                    result.append(NodeInfo(name=name, namespace=namespace))
            return result

    def scan_all(self, domain_id: int) -> ScanResult:
        from datetime import datetime, timezone
        return ScanResult(
            domain_id=domain_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            topics=self.scan_topics(domain_id),
            services=self.scan_services(domain_id),
            actions=self.scan_actions(domain_id),
            nodes=self.scan_nodes(domain_id),
        )

    # ── Graph (rqt_graph compatible) ──────────────────────────────────────

    def get_graph(self, domain_id: int) -> GraphData:
        """
        Builds graph data using the same topic-centric algorithm as rqt_graph:

          for each topic:
              pub_infos = get_publishers_info_by_topic(topic)
              sub_infos = get_subscriptions_info_by_topic(topic)
              nn_edges  ← product(pub_node_ids, sub_node_ids)
              nt_topic  ← GraphTopicInfo(name, type, publishers, subscribers)

        This is O(topics) API calls — NOT O(topics × nodes).
        The old O(N²) loop using get_publisher_names_and_types_by_node() per node
        was the primary cause of empty/wrong graphs.
        """
        with self._locks[domain_id]:
            node = self._get_node(domain_id)

            # ── Build node registry ───────────────────────────────────────
            graph_nodes: list[GraphNode] = []
            seen_nodes: set[str] = set()

            for name, namespace in node.get_node_names_and_namespaces():
                if _is_scanner(name):
                    continue
                nid = _node_id(namespace, name)
                if nid not in seen_nodes:
                    seen_nodes.add(nid)
                    graph_nodes.append(GraphNode(id=nid, namespace=namespace))

            # ── Build edges topic-centrically (rqt_graph style) ──────────
            nn_edges: list[GraphEdge] = []
            graph_topics: list[GraphTopicInfo] = []

            for topic_name, types in node.get_topic_names_and_types():
                type_str = types[0] if types else "unknown"

                # Get publisher and subscriber endpoint info in O(1) per topic
                try:
                    pub_infos = node.get_publishers_info_by_topic(topic_name)
                    sub_infos = node.get_subscriptions_info_by_topic(topic_name)
                except Exception:
                    continue

                # Extract node IDs, filter out scanner + unknown endpoints
                pub_ids: list[str] = []
                for info in pub_infos:
                    if _is_scanner(info.node_name):
                        continue
                    if "_UNKNOWN_" in info.node_name or "_UNKNOWN_" in info.node_namespace:
                        continue
                    nid = _node_id(info.node_namespace, info.node_name)
                    if nid not in pub_ids:
                        pub_ids.append(nid)

                sub_ids: list[str] = []
                for info in sub_infos:
                    if _is_scanner(info.node_name):
                        continue
                    if "_UNKNOWN_" in info.node_name or "_UNKNOWN_" in info.node_namespace:
                        continue
                    nid = _node_id(info.node_namespace, info.node_name)
                    if nid not in sub_ids:
                        sub_ids.append(nid)

                # Record topic info for frontend rqt_graph-style filtering
                graph_topics.append(GraphTopicInfo(
                    name=topic_name,
                    type=type_str,
                    publishers=pub_ids,
                    subscribers=sub_ids,
                ))

                # Build nn_edges: direct publisher_node → subscriber_node
                # (same as rqt_graph's nn_edges = product(pub_nodes, sub_nodes))
                for pub_id in pub_ids:
                    for sub_id in sub_ids:
                        if pub_id != sub_id:
                            nn_edges.append(GraphEdge(
                                source=pub_id,
                                target=sub_id,
                                topic=topic_name,
                                type=type_str,
                            ))

            return GraphData(
                nodes=graph_nodes,
                edges=nn_edges,
                topics=graph_topics,
            )
