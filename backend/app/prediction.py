"""Predictive vulnerability and failure risk engine based on graph topology and dependency physics.
Implements Feature 3 & Feature 4 from V2_doc.md.
"""
from __future__ import annotations

import math
from typing import Literal
from pydantic import BaseModel, Field
import networkx as nx

from app.models import ContractModel, Domain, Graph, Priority
from app.graph_repository import get_network_graph


class PredictionRequest(ContractModel):
    graph_version: str
    node_id: str
    severity: Literal["mild", "moderate", "severe"] = "severe"
    duration_steps: int = Field(default=6, ge=1, le=12)


class PredictedNodeImpact(BaseModel):
    id: str
    name: str
    domain: Domain
    priority: Priority
    priority_weight: int
    failure_probability: float  # 0.0 - 1.0
    disruption_pct: int         # 0 - 100
    predicted_state: Literal["failed", "degraded", "at_risk", "nominal"]
    hop_distance: int
    direct_dependency: bool
    causal_reason: str


class DomainImpactSummary(BaseModel):
    domain: Domain
    disrupted_count: int
    total_count: int
    average_disruption: float  # 0.0 - 1.0
    status: Literal["critical", "severe", "moderate", "low", "nominal"]


class ImpactPrediction(BaseModel):
    graph_version: str
    target_node_id: str
    target_node_name: str
    severity: str
    blast_radius_km: float
    total_assets_at_risk: int
    critical_assets_at_risk: int
    priority_weighted_risk_score: float
    executive_summary: str
    domain_breakdowns: list[DomainImpactSummary]
    affected_nodes: list[PredictedNodeImpact]
    recommended_interventions: list[str]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate geographic distance in kilometers between two lat/lng coordinates."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(r * c, 2)


def predict_impact(graph: Graph, request: PredictionRequest) -> ImpactPrediction:
    nodes_by_id = {node.id: node for node in graph.nodes}
    if request.node_id not in nodes_by_id:
        raise ValueError(f"Unknown node ID: {request.node_id}")

    target = nodes_by_id[request.node_id]
    net = get_network_graph()

    # Severity multiplier
    sev_mult = {"mild": 0.35, "moderate": 0.65, "severe": 1.0}[request.severity]

    # Calculate directed shortest paths from the failed node to all reachable nodes
    try:
        path_lengths = nx.single_source_shortest_path_length(net, request.node_id)
    except Exception:
        path_lengths = {request.node_id: 0}

    # Find incoming dependencies into each node from the target or affected paths
    dependencies = [e for e in graph.edges if e.kind == "dependency"]

    ranked_nodes: list[PredictedNodeImpact] = []
    max_dist_km = 0.0

    for node_id, node in nodes_by_id.items():
        if node_id == request.node_id:
            # Root failure
            dist_km = 0.0
            prob = 1.0
            disruption = int(100 * sev_mult)
            state: Literal["failed", "degraded", "at_risk", "nominal"] = "failed" if sev_mult >= 0.8 else "degraded"
            reason = f"Ground zero: direct {request.severity} failure injected on {node.name}."
            hop = 0
            is_direct = False
        elif node_id in path_lengths:
            hop = path_lengths[node_id]
            dist_km = haversine_km(target.location.lat, target.location.lng, node.location.lat, node.location.lng)
            if dist_km > max_dist_km:
                max_dist_km = dist_km

            # Incoming dependency links
            incoming_weights = [
                e.weight for e in dependencies if e.target == node_id
            ]
            total_weight = sum(incoming_weights) if incoming_weights else 0.35

            # Headroom vulnerability
            headroom_stress = node.base_load / node.capacity

            # Distance decay: each hop diminishes probability
            hop_decay = 1.0 / (1.0 + 0.65 * (hop - 1))

            # Raw risk calculation
            raw_risk = sev_mult * total_weight * (0.5 + 0.5 * headroom_stress) * hop_decay
            prob = max(0.08, min(0.98, raw_risk))
            disruption = int(round(prob * 100))

            if prob >= 0.70:
                state = "failed"
                reason = f"High probability ({int(prob*100)}%) of cascading failure due to critical {node.domain} dependency."
            elif prob >= 0.40:
                state = "degraded"
                reason = f"Capacity buffer exceeded ({int(headroom_stress*100)}% base load). Operational degradation expected."
            elif prob >= 0.15:
                state = "at_risk"
                reason = f"Indirect dependency strain ({hop} hops away). Vulnerable under prolonged disruption."
            else:
                state = "nominal"
                reason = f"Sufficient headroom ({int((1-headroom_stress)*100)}% reserve) to absorb transient stress."

            is_direct = hop == 1
        else:
            continue

        ranked_nodes.append(
            PredictedNodeImpact(
                id=node.id,
                name=node.name,
                domain=node.domain,
                priority=node.priority,
                priority_weight=node.priority_weight,
                failure_probability=round(prob, 2),
                disruption_pct=disruption,
                predicted_state=state,
                hop_distance=hop,
                direct_dependency=is_direct,
                causal_reason=reason,
            )
        )

    # Sort nodes by failure probability descending, then by priority weight descending
    ranked_nodes.sort(key=lambda x: (x.failure_probability, x.priority_weight), reverse=True)

    # Filter to only affected or at-risk nodes (disruption >= 15%)
    active_affected = [n for n in ranked_nodes if n.disruption_pct >= 15]

    # Domain summary
    domain_nodes: dict[Domain, list[PredictedNodeImpact]] = {
        "power": [], "water": [], "traffic": [], "healthcare": [], "public_safety": []
    }
    for n in ranked_nodes:
        domain_nodes[n.domain].append(n)

    domain_summaries: list[DomainImpactSummary] = []
    for dom, dom_list in domain_nodes.items():
        total_in_domain = len([n for n in graph.nodes if n.domain == dom])
        impacted = [n for n in dom_list if n.disruption_pct >= 25]
        avg_disr = (sum(n.failure_probability for n in dom_list) / total_in_domain) if total_in_domain else 0.0

        if avg_disr >= 0.60:
            status = "critical"
        elif avg_disr >= 0.40:
            status = "severe"
        elif avg_disr >= 0.20:
            status = "moderate"
        elif impacted:
            status = "low"
        else:
            status = "nominal"

        domain_summaries.append(
            DomainImpactSummary(
                domain=dom,
                disrupted_count=len(impacted),
                total_count=total_in_domain,
                average_disruption=round(avg_disr, 2),
                status=status,
            )
        )

    # Priority-weighted damage score
    total_score = sum(n.priority_weight * (n.disruption_pct / 100.0) for n in active_affected)
    critical_count = len([n for n in active_affected if n.priority == "critical"])

    # High-leverage intervention recommendations
    recommendations = []
    protectable_candidates = [
        n for n in active_affected if n.id != request.node_id and nodes_by_id[n.id].protectable
    ]
    if protectable_candidates:
        top_protect = protectable_candidates[0]
        recommendations.append(
            f"Harden {top_protect.name} ({top_protect.domain.replace('_', ' ').title()}): Absorbs downstream shock and cuts off secondary cascading failure."
        )
        if len(protectable_candidates) > 1:
            second_protect = protectable_candidates[1]
            recommendations.append(
                f"Isolate feed at {second_protect.name}: Protects operational reserve and preserves critical {second_protect.domain} capacity."
            )
    else:
        recommendations.append("Deploy emergency secondary routing along primary arterial bridges.")

    # Executive narrative
    impacted_domain_names = [d.domain.replace("_", " ") for d in domain_summaries if d.status in ("critical", "severe", "moderate")]
    domains_phrase = ", ".join(impacted_domain_names) if impacted_domain_names else "local assets"
    summary_text = (
        f"A {request.severity} disruption at {target.name} triggers a projected blast radius of ~{max(1.2, max_dist_km):.1f} km, "
        f"placing {len(active_affected)} assets at severe risk ({critical_count} critical tier). "
        f"Cascading dependencies predominantly threaten {domains_phrase}. "
        f"Implementing targeted hardening on {recommendations[0].split(':')[0].replace('Harden ', '')} "
        f"is predicted to mitigate up to {min(85, int(sev_mult * 70 + 15))}% of peripheral failure transmission."
    )

    return ImpactPrediction(
        graph_version=graph.graph_version,
        target_node_id=request.node_id,
        target_node_name=target.name,
        severity=request.severity,
        blast_radius_km=max(1.2, round(max_dist_km, 1)),
        total_assets_at_risk=len(active_affected),
        critical_assets_at_risk=critical_count,
        priority_weighted_risk_score=round(total_score, 1),
        executive_summary=summary_text,
        domain_breakdowns=domain_summaries,
        affected_nodes=active_affected,
        recommended_interventions=recommendations,
    )
