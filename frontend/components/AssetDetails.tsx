import type { GraphEdge, GraphNode, OperationalState } from "@/lib/types";

interface AssetDetailsProps {
  node: GraphNode;
  state: OperationalState;
  disruption: number;
  incoming: GraphEdge[];
  outgoing: GraphEdge[];
  onClose: () => void;
}

export function AssetDetails({ node, state, disruption, incoming, outgoing, onClose }: AssetDetailsProps) {
  const dependencies = [...incoming, ...outgoing].filter((edge) => edge.kind === "dependency");
  return (
    <aside className="asset-panel" aria-labelledby="asset-panel-title">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Selected asset</span>
          <h2 id="asset-panel-title">{node.name}</h2>
          <code>{node.id}</code>
        </div>
        <button type="button" className="close-button" onClick={onClose} aria-label="Close asset details">×</button>
      </div>

      <div className="asset-badges">
        <span className={`domain-badge ${node.domain}`}>{node.domain}</span>
        <span className={`priority-badge ${node.priority}`}>{node.priority} priority</span>
        <span className={`state-badge ${state}`}>{state}</span>
      </div>

      <dl className="asset-facts">
        <div><dt>Base load</dt><dd>{node.base_load} NSU</dd></div>
        <div><dt>Capacity</dt><dd>{node.capacity} NSU</dd></div>
        <div><dt>Disruption</dt><dd>{Math.round(disruption * 100)}%</dd></div>
        <div><dt>Type</dt><dd>{node.type.replaceAll("_", " ")}</dd></div>
      </dl>

      <div className="dependency-summary">
        <span>Dependencies</span>
        <strong>{incoming.filter((edge) => edge.kind === "dependency").length} in · {outgoing.filter((edge) => edge.kind === "dependency").length} out</strong>
      </div>
      <ul className="dependency-list">
        {dependencies.slice(0, 4).map((edge) => (
          <li key={edge.id}>
            <span>{edge.source === node.id ? "→" : "←"} {edge.relationship.replaceAll("_", " ")}</span>
            <small>{edge.provenance} · {edge.confidence}</small>
          </li>
        ))}
        {dependencies.length === 0 && <li><span>No declared dependency edges</span><small>Physical connections may still be present.</small></li>}
      </ul>

      <div className="provenance-card">
        <span className="eyebrow">Provenance</span>
        <strong>{node.provenance.kind} · {node.provenance.confidence} confidence</strong>
        <p>{node.provenance.source}</p>
      </div>
    </aside>
  );
}
