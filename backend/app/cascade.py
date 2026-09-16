"""Small deterministic demonstration model; NSU values are illustrative."""
from typing import Literal
from pydantic import Field
from app.models import ContractModel, Graph

class CascadeRequest(ContractModel):
    graph_version: str
    node_id: str
    severity: Literal['mild', 'moderate', 'severe'] = 'severe'
    duration_steps: int = Field(default=6, ge=1, le=12)

def simulate(graph: Graph, request: CascadeRequest) -> dict:
    nodes = {node.id: node for node in graph.nodes}
    if request.graph_version != graph.graph_version:
        raise ValueError('Graph changed. Reload the map before running.')
    if request.node_id not in nodes:
        raise ValueError('Unknown asset')
    disruption = {node_id: 0.0 for node_id in nodes}
    latest = {}
    events = []
    dependencies = [edge for edge in graph.edges if edge.kind == 'dependency']
    severity = {'mild': .25, 'moderate': .55, 'severe': 1.0}[request.severity]
    def state(value):
        return 'failed' if value >= 1 else 'degraded' if value >= .5 else 'stressed' if value > 0 else 'normal'
    truncated = True
    for step in range(13):
        updated = dict(disruption)
        changed = []
        for node_id, node in sorted(nodes.items()):
            incoming = [e for e in dependencies if e.target == node_id and disruption[e.source] > 0]
            ratio = (node.base_load + sum(100 * e.weight * disruption[e.source] for e in incoming)) / node.capacity
            value = severity if node_id == request.node_id else max(disruption[node_id], min(1.0, max(0.0, (ratio - .85) / .35)))
            if value - disruption[node_id] < 1e-9:
                continue
            updated[node_id] = value
            event_id = f'evt-{step:02d}-{len(changed):03d}'
            root = node_id == request.node_id
            changed.append(dict(event_id=event_id, step=step, node_id=node_id,
                causal_event_ids=[] if root else sorted({latest[e.source] for e in incoming}),
                cause_edge_ids=[] if root else [e.id for e in incoming],
                previous_state=state(disruption[node_id]), new_state=state(value),
                previous_disruption=round(disruption[node_id], 4), new_disruption=round(value, 4),
                load_ratio=None if root else round(ratio, 4),
                reason=f'{node.name}: selected {request.severity} outage ({severity:.0%} disruption).' if root else
                f'{node.name}: assumed dependency stress raises load to {ratio:.0%} of illustrative capacity; disruption {value:.0%}.'))
        if not changed:
            truncated = False
            break
        events.extend(changed)
        latest.update({e['node_id']: e['event_id'] for e in changed})
        disruption = updated
    return dict(graph_version=graph.graph_version, model_version='demo-nsu-0.1.0',
        input=request.model_dump(), events=events, truncated=truncated,
        assumptions=['Capacities, loads and dependencies are illustrative NSU model values.',
                     'Duration is a scenario horizon label, not a recovery forecast; it does not change propagation.',
                     'Only declared dependency edges transfer stress. Geographic links do not.'])
