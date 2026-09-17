export type Domain = "power" | "water" | "traffic" | "healthcare" | "public_safety";
export type Priority = "critical" | "high" | "medium" | "low";
export type OperationalState = "normal" | "stressed" | "degraded" | "failed";
export type ProvenanceKind = "observed" | "derived" | "inferred" | "assumed" | "synthetic";
export type Confidence = "high" | "medium" | "low";

export interface GraphNode {
  id: string;
  name: string;
  type: string;
  domain: Domain;
  priority: Priority;
  priority_weight: number;
  base_load: number;
  capacity: number;
  location: { lat: number; lng: number };
  protectable: boolean;
  provenance: {
    kind: ProvenanceKind;
    source: string;
    confidence: Confidence;
  };
  osm?: {
    element_type: "node" | "way" | "relation";
    element_id: number;
    url: string;
    tags: Record<string, string>;
  } | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: "physical" | "dependency";
  relationship: string;
  weight: number;
  provenance: ProvenanceKind;
  confidence: Confidence;
}

export interface NetworkGraph {
  graph_version: string;
  name: string;
  generated_at: string | null;
  locality: {
    name: string;
    coordinate_reference: "WGS84";
    bounding_box: { south: number; west: number; north: number; east: number };
  };
  units: { load: "NSU"; capacity: "NSU"; edge_weight: string };
  nodes: GraphNode[];
  edges: GraphEdge[];
  attributions: Array<{
    name: string;
    license: string;
    url: string | null;
    retrieved_at: string | null;
  }>;
}

export interface CascadeEvent {
  event_id: string;
  step: number;
  node_id: string;
  causal_event_ids: string[];
  cause_edge_ids: string[];
  previous_state: OperationalState;
  new_state: OperationalState;
  previous_disruption: number;
  new_disruption: number;
  load_ratio: number | null;
  reason: string;
}

export interface CascadeMetrics {
  affected_assets: number;
  failed_assets: number;
  affected_critical_assets: number;
  priority_weighted_damage: number;
  propagation_depth: number;
}

export interface PredictedNodeImpact {
  id: string;
  name: string;
  domain: Domain;
  priority: Priority;
  priority_weight: number;
  failure_probability: number;
  disruption_pct: number;
  predicted_state: "failed" | "degraded" | "at_risk" | "nominal";
  hop_distance: number;
  direct_dependency: boolean;
  causal_reason: string;
}

export interface DomainImpactSummary {
  domain: Domain;
  disrupted_count: number;
  total_count: number;
  average_disruption: number;
  status: "critical" | "severe" | "moderate" | "low" | "nominal";
}

export interface ImpactPrediction {
  graph_version: string;
  target_node_id: string;
  target_node_name: string;
  severity: string;
  blast_radius_km: number;
  total_assets_at_risk: number;
  critical_assets_at_risk: number;
  priority_weighted_risk_score: number;
  executive_summary: string;
  domain_breakdowns: DomainImpactSummary[];
  affected_nodes: PredictedNodeImpact[];
  recommended_interventions: string[];
}

export interface AgentChatResponse {
  response: string;
}
