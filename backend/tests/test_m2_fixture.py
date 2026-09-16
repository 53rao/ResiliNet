from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.graph_repository import get_graph


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_PATH = REPOSITORY_ROOT / "frontend" / "data" / "m2-cascade-fixture.json"
CONTEXT_PATH = REPOSITORY_ROOT / "frontend" / "public" / "data" / "osm-context.geojson"
CONTEXT_METADATA_PATH = REPOSITORY_ROOT / "frontend" / "public" / "data" / "osm-import-metadata.json"


def test_fixture_uses_graph_ids_and_ordered_causal_references() -> None:
    graph = get_graph()
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    node_ids = {node.id for node in graph.nodes}
    edge_ids = {edge.id for edge in graph.edges}
    seen_event_ids: set[str] = set()
    ordering: list[tuple[int, str]] = []

    assert fixture["graph_version"] == graph.graph_version
    assert fixture["model_version"] == "fixture-playback-0.3.0"
    assert len(fixture["node_results"]) == len(graph.nodes)

    for event in fixture["events"]:
        assert event["node_id"] in node_ids
        assert set(event["cause_edge_ids"]) <= edge_ids
        assert set(event["causal_event_ids"]) <= seen_event_ids
        assert 0 <= event["new_disruption"] <= 1
        ordering.append((event["step"], event["node_id"]))
        seen_event_ids.add(event["event_id"])

    assert ordering == sorted(ordering)


def test_fixture_final_metrics_match_its_node_results() -> None:
    graph = get_graph()
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    nodes = {node.id: node for node in graph.nodes}
    affected = [result for result in fixture["node_results"] if result["disruption_fraction"] > 0]

    assert fixture["metrics"]["affected_assets"] == len(affected)
    assert fixture["metrics"]["failed_assets"] == sum(result["state"] == "failed" for result in affected)
    assert fixture["metrics"]["affected_critical_assets"] == sum(nodes[result["node_id"]].priority == "critical" for result in affected)
    expected_damage = sum(nodes[result["node_id"]].priority_weight * result["disruption_fraction"] for result in affected)
    assert fixture["metrics"]["priority_weighted_damage"] == pytest.approx(expected_damage, abs=0.0001)
    assert sum(fixture["domain_damage"].values()) == pytest.approx(expected_damage, abs=0.0001)


def test_local_osm_context_is_bundled_without_runtime_tile_dependencies() -> None:
    context_text = CONTEXT_PATH.read_text(encoding="utf-8")
    context = json.loads(context_text)
    metadata = json.loads(CONTEXT_METADATA_PATH.read_text(encoding="utf-8"))

    assert context["type"] == "FeatureCollection"
    assert context["provenance"]["kind"] == "observed"
    assert context["provenance"]["license"] == "ODbL 1.0"
    assert context["radius_metres"] == 50_000
    assert len(context["features"]) >= 1_000
    assert metadata["runtime_network_requests"] == 0
    assert "tile.openstreetmap.org" not in context_text
