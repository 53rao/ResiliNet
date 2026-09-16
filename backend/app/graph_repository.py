"""Load and validate the bundled graph once for read-only API access."""

from __future__ import annotations

from functools import lru_cache
import os
from pathlib import Path

import networkx as nx

from app.models import Graph


BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GRAPH_PATH = BACKEND_ROOT / "data" / "graph.json"


def resolve_graph_path() -> Path:
    configured = os.getenv("GRAPH_PATH")
    if not configured:
        return DEFAULT_GRAPH_PATH
    candidate = Path(configured)
    return candidate if candidate.is_absolute() else BACKEND_ROOT / candidate


@lru_cache(maxsize=1)
def get_graph() -> Graph:
    graph_path = resolve_graph_path()
    try:
        raw_graph = graph_path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise RuntimeError(f"Graph file not found: {graph_path}") from error
    return Graph.model_validate_json(raw_graph)


@lru_cache(maxsize=1)
def get_network_graph() -> nx.MultiDiGraph:
    """Build the cached NetworkX representation used by topology and simulation code."""
    graph = get_graph()
    network = nx.MultiDiGraph(graph_version=graph.graph_version, locality=graph.locality.name)
    for node in graph.nodes:
        network.add_node(
            node.id,
            name=node.name,
            domain=node.domain,
            priority=node.priority,
            lat=node.location.lat,
            lng=node.location.lng,
        )
    for edge in graph.edges:
        network.add_edge(
            edge.source,
            edge.target,
            key=edge.id,
            edge_id=edge.id,
            kind=edge.kind,
            relationship=edge.relationship,
            weight=edge.weight,
            provenance=edge.provenance,
            confidence=edge.confidence,
        )
    return network
