import type { HealthResponse, NetworkGraph, TopologyResponse } from "@/lib/types";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8001";

export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/health`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`API returned HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isHealthResponse(data)) {
    throw new Error("API returned an invalid health response");
  }
  return data;
}

export async function fetchGraph(signal?: AbortSignal): Promise<NetworkGraph> {
  const response = await fetch(`${getApiBaseUrl()}/graph`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Graph API returned HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isNetworkGraph(data)) {
    throw new Error("Graph API returned an invalid graph");
  }
  return data;
}

export async function fetchTopology(signal?: AbortSignal): Promise<TopologyResponse> {
  const response = await fetch(`${getApiBaseUrl()}/graph/topology`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Topology API returned HTTP ${response.status}`);
  const data = await response.json() as TopologyResponse;
  if (typeof data.engine !== "string" || typeof data.nodes !== "number" || typeof data.edges !== "number") {
    throw new Error("Topology API returned an invalid response");
  }
  return data;
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.status === "ok" &&
    candidate.service === "resilicity-api" &&
    typeof candidate.api_version === "string" &&
    typeof candidate.graph_version === "string"
  );
}

function isNetworkGraph(value: unknown): value is NetworkGraph {
  if (!value || typeof value !== "object") return false;
  const graph = value as Record<string, unknown>;
  if (
    typeof graph.graph_version !== "string" ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges)
  ) {
    return false;
  }

  const nodeIds = new Set<string>();
  for (const rawNode of graph.nodes) {
    if (!rawNode || typeof rawNode !== "object") return false;
    const node = rawNode as Record<string, unknown>;
    const location = node.location as Record<string, unknown> | undefined;
    if (
      typeof node.id !== "string" ||
      typeof node.name !== "string" ||
      !["power", "water", "traffic", "healthcare", "public_safety"].includes(String(node.domain)) ||
      typeof location?.lat !== "number" ||
      typeof location?.lng !== "number"
    ) {
      return false;
    }
    nodeIds.add(node.id);
  }
  if (nodeIds.size !== graph.nodes.length) return false;

  return graph.edges.every((rawEdge) => {
    if (!rawEdge || typeof rawEdge !== "object") return false;
    const edge = rawEdge as Record<string, unknown>;
    return (
      typeof edge.id === "string" &&
      typeof edge.source === "string" &&
      typeof edge.target === "string" &&
      nodeIds.has(edge.source) &&
      nodeIds.has(edge.target) &&
      ["physical", "dependency"].includes(String(edge.kind))
    );
  });
}

export interface DemoRun {
  graph_version: string;
  model_version: string;
  input: { graph_version: string; node_id: string; severity: "mild" | "moderate" | "severe"; duration_steps: number };
  events: import("./types").CascadeEvent[];
  truncated: boolean;
  assumptions: string[];
}

export async function runCascade(input: DemoRun["input"], signal?: AbortSignal): Promise<DemoRun> {
  const response = await fetch(`${getApiBaseUrl()}/cascade`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.detail === "string" ? error.detail : `Simulation failed (HTTP ${response.status})`);
  }
  return response.json();
}

export async function predictImpact(
  input: { graph_version: string; node_id: string; severity: "mild" | "moderate" | "severe"; duration_steps: number },
  signal?: AbortSignal
): Promise<import("./types").ImpactPrediction> {
  const response = await fetch(`${getApiBaseUrl()}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(typeof error?.detail === "string" ? error.detail : `Prediction failed (HTTP ${response.status})`);
  }
  return response.json();
}

