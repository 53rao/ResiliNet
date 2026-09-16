"""Pydantic contracts for the versioned ResiliCity graph."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


Domain = Literal["power", "water", "traffic", "healthcare", "public_safety"]
Priority = Literal["critical", "high", "medium", "low"]
Confidence = Literal["high", "medium", "low"]
ProvenanceKind = Literal["observed", "derived", "inferred", "assumed", "synthetic"]
EdgeKind = Literal["physical", "dependency"]


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Location(ContractModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class Provenance(ContractModel):
    kind: ProvenanceKind
    source: str = Field(min_length=1)
    confidence: Confidence


class OpenStreetMapReference(ContractModel):
    element_type: Literal["node", "way", "relation"]
    element_id: int = Field(gt=0)
    url: str = Field(pattern=r"^https://www\.openstreetmap\.org/(node|way|relation)/\d+$")
    tags: dict[str, str]


class GraphNode(ContractModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    type: str = Field(min_length=1)
    domain: Domain
    priority: Priority
    priority_weight: int = Field(ge=1, le=4)
    base_load: float = Field(ge=0)
    capacity: float = Field(gt=0)
    location: Location
    protectable: bool
    provenance: Provenance
    osm: OpenStreetMapReference | None = None

    @model_validator(mode="after")
    def validate_normal_load(self) -> GraphNode:
        if self.base_load >= self.capacity:
            raise ValueError(f"node {self.id} must start below capacity")
        return self


class GraphEdge(ContractModel):
    id: str = Field(min_length=1)
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    kind: EdgeKind
    relationship: str = Field(min_length=1)
    weight: float = Field(ge=0, le=1)
    provenance: ProvenanceKind
    confidence: Confidence


class BoundingBox(ContractModel):
    south: float
    west: float
    north: float
    east: float

    @model_validator(mode="after")
    def validate_order(self) -> BoundingBox:
        if self.south >= self.north or self.west >= self.east:
            raise ValueError("bounding box coordinates must be ordered")
        return self


class Locality(ContractModel):
    name: str = Field(min_length=1)
    coordinate_reference: Literal["WGS84"]
    bounding_box: BoundingBox


class Units(ContractModel):
    load: Literal["NSU"]
    capacity: Literal["NSU"]
    edge_weight: str = Field(min_length=1)


class Attribution(ContractModel):
    name: str
    license: str
    url: str | None
    retrieved_at: str | None


class Graph(ContractModel):
    graph_version: str = Field(pattern=r"^\d+\.\d+\.\d+$")
    name: str = Field(min_length=1)
    generated_at: str | None
    locality: Locality
    units: Units
    nodes: list[GraphNode] = Field(min_length=1, max_length=500)
    edges: list[GraphEdge]
    attributions: list[Attribution]

    @model_validator(mode="after")
    def validate_graph_integrity(self) -> Graph:
        node_ids = [node.id for node in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("node IDs must be unique")

        edge_ids = [edge.id for edge in self.edges]
        if len(edge_ids) != len(set(edge_ids)):
            raise ValueError("edge IDs must be unique")

        known_nodes = set(node_ids)
        bounds = self.locality.bounding_box
        for node in self.nodes:
            if not (bounds.south <= node.location.lat <= bounds.north):
                raise ValueError(f"node {node.id} latitude is outside the locality")
            if not (bounds.west <= node.location.lng <= bounds.east):
                raise ValueError(f"node {node.id} longitude is outside the locality")

        for edge in self.edges:
            if edge.source == edge.target:
                raise ValueError(f"edge {edge.id} cannot be a self-edge")
            if edge.source not in known_nodes or edge.target not in known_nodes:
                raise ValueError(f"edge {edge.id} references an unknown node")

        return self
