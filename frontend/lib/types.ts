export type ApiHealthStatus = "checking" | "online" | "offline";

export interface HealthResponse {
  status: "ok";
  service: "resilicity-api";
  api_version: string;
  graph_version: string;
}

export interface HealthState {
  status: ApiHealthStatus;
  response: HealthResponse | null;
  message: string;
}

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

export interface TopologyResponse {
  graph_version: string;
  engine: string;
  nodes: number;
  edges: number;
  weakly_connected_components: number;
  strongly_connected_components: number;
  isolates: number;
  density: number;
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

export interface NodeResult {
  node_id: string;
  state: OperationalState;
  disruption_fraction: number;
  effective_load: number;
  effective_capacity: number;
  load_ratio: number | null;
  damage: number;
  first_affected_step: number | null;
  causal_event_ids: string[];
}

export interface CascadeMetrics {
  affected_assets: number;
  failed_assets: number;
  affected_critical_assets: number;
  priority_weighted_damage: number;
  propagation_depth: number;
}

export interface CascadeResult {
  run_id: string;
  scenario_id: string;
  request_id: string;
  graph_version: string;
  model_version: string;
  input: {
    graph_version: string;
    node_id: string;
    severity: "mild" | "moderate" | "severe";
    duration_steps: number;
    seed: number;
  };
  started_at: string;
  completed_at: string;
  events: CascadeEvent[];
  node_results: NodeResult[];
  metrics: CascadeMetrics;
  domain_damage: Record<Domain, number>;
  assumptions: string[];
  timing: { load_ms: number; cascade_ms: number; total_ms: number };
  truncated: boolean;
}

export interface LocalContext {
  type: "FeatureCollection";
  name: string;
  provenance: {
    kind: ProvenanceKind;
    source: string;
    confidence: Confidence;
    notice: string;
    license: string;
    url: string;
    retrieved_at: string;
  };
  center: { lat: number; lng: number };
  radius_metres: number;
  raw_feature_count: number;
  features: Array<{
    type: "Feature";
    properties: {
      kind: string;
      name: string;
      domain?: Domain;
      asset_type?: string;
      osm_type?: string;
      osm_id?: number;
      selected_for_network?: boolean;
    };
    geometry: { type: string; coordinates: unknown };
  }>;
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

export interface Protection {
  node_id: string;
  parameter: string;
  old_value: number;
  new_value: number;
  multiplier: number;
}

export interface OptimizationSearchStats {
  evaluated_sets: number;
  cache_hits: number;
  iterations: number;
  elapsed_ms: number;
  greedy_evaluated: boolean;
  no_action_evaluated: boolean;
}

export interface OptimizationObjective {
  name: string;
  baseline_damage: number;
  mitigated_damage: number;
  absolute_improvement: number;
  percentage_improvement: number | null;
}

export interface OptimizationResult {
  optimization_id: string;
  request_id: string;
  baseline_run_id: string;
  graph_version: string;
  model_version: string;
  input: any;
  algorithm_used: string;
  selected_protections: Protection[];
  search_stats: OptimizationSearchStats;
  objective: OptimizationObjective;
  mitigated_result: CascadeResult;
  timing: any;
  termination_reason: string;
}

export interface AgentChatResponse {
  response: string;
}
