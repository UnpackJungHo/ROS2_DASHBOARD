from pydantic import BaseModel


class TopicInfo(BaseModel):
    name: str
    type: str
    publishers: int
    subscribers: int
    hz: float | None = None


class ServiceInfo(BaseModel):
    name: str
    type: str
    available: bool


class ActionInfo(BaseModel):
    name: str
    type: str


class NodeInfo(BaseModel):
    name: str
    namespace: str


class GraphNode(BaseModel):
    id: str
    namespace: str


class GraphEdge(BaseModel):
    source: str
    target: str
    topic: str
    type: str


class GraphTopicInfo(BaseModel):
    """Per-topic publisher/subscriber node lists — mirrors rqt_graph's nt_nodes data."""
    name: str
    type: str
    publishers: list[str]   # node IDs
    subscribers: list[str]  # node IDs


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]          # nn_edges: direct node→node (one per pub×sub×topic)
    topics: list[GraphTopicInfo]    # raw topic data for frontend rqt_graph-style filtering


class ScanResult(BaseModel):
    domain_id: int
    timestamp: str
    topics: list[TopicInfo]
    services: list[ServiceInfo]
    actions: list[ActionInfo]
    nodes: list[NodeInfo]
