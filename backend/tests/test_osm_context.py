from __future__ import annotations

import json
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
CONTEXT_PATH = REPOSITORY_ROOT / "frontend" / "public" / "data" / "osm-context.geojson"
CONTEXT_METADATA_PATH = REPOSITORY_ROOT / "frontend" / "public" / "data" / "osm-import-metadata.json"


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
