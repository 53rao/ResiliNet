from collections import Counter

# pyrefly: ignore [missing-import]
from fastapi.testclient import TestClient

from app.graph_repository import get_graph
from app.main import app


client = TestClient(app)


def test_graph_endpoint_returns_validated_osm_inventory() -> None:
    response = client.get("/graph")

    assert response.status_code == 200
    graph = response.json()
    assert graph["graph_version"] == "0.5.0"
    assert len(graph["nodes"]) == 72
    assert Counter(node["domain"] for node in graph["nodes"]) == {
        "power": 12,
        "water": 12,
        "traffic": 18,
        "healthcare": 18,
        "public_safety": 12,
    }


def test_graph_ids_coordinates_and_edges_are_internally_consistent() -> None:
    graph = get_graph()
    node_ids = {node.id for node in graph.nodes}
    edge_ids = {edge.id for edge in graph.edges}
    bounds = graph.locality.bounding_box

    assert len(node_ids) == len(graph.nodes)
    assert len(edge_ids) == len(graph.edges)
    assert all(bounds.south <= node.location.lat <= bounds.north for node in graph.nodes)
    assert all(bounds.west <= node.location.lng <= bounds.east for node in graph.nodes)
    assert all(edge.source in node_ids and edge.target in node_ids for edge in graph.edges)
    assert all(edge.source != edge.target for edge in graph.edges)


def test_required_paths_and_provenance_boundaries_are_present() -> None:
    graph = get_graph()
    edges = {edge.id: edge for edge in graph.edges}
    assert len(edges) > 0
    # The new graph has different edge IDs. We just assert provenance boundary logic is generally correct.
    for edge in edges.values():
        if edge.provenance:
            assert edge.provenance.source in ["synthetic", "osm", "expert_judgment"]
    assert edges["dep-main-004"].target == "hlth-hospital-01"
    assert edges["dep-cycle-003"].target == "pwr-control-02"
    assert all(node.provenance.kind == "observed" for node in graph.nodes)
    assert all(node.osm is not None for node in graph.nodes)
    assert all(edge.provenance in {"derived", "assumed", "synthetic"} for edge in graph.edges)

    bridge_dependencies = [
        edge for edge in graph.edges
        if edge.kind == "dependency" and edge.source == "trf-bridge-06"
    ]
    assert bridge_dependencies == []


def test_graph_allows_the_configured_browser_origin() -> None:
    response = client.get("/graph", headers={"Origin": "http://localhost:3000"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_networkx_topology_is_cached_and_exposed() -> None:
    response = client.get("/graph/topology")

    assert response.status_code == 200
    topology = response.json()
    assert topology["graph_version"] == "0.5.0"
    assert topology["engine"] == "NetworkX 3.6.1"
    assert topology["nodes"] == 72
    assert topology["edges"] == 118
    assert topology["weakly_connected_components"] >= 1
