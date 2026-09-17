"use client";

import React, { useState } from "react";
import type { Domain, ImpactPrediction } from "@/lib/types";
import { AgentRunningView } from "@/components/AgentRunningView";
import { AgentMarkdown } from "@/components/AgentMarkdown";

const DOMAIN_COLOR: Record<Domain, string> = {
  power: "#4ade80",
  water: "#38bdf8",
  traffic: "#818cf8",
  healthcare: "#f87171",
  public_safety: "#fb923c",
};

const DOMAIN_ICON: Record<Domain, string> = {
  power: "⚡",
  water: "💧",
  traffic: "🌉",
  healthcare: "✚",
  public_safety: "🚑",
};

interface ImpactReportModalProps {
  prediction: ImpactPrediction;
  managementChat?: any;
  citizenChat?: any;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
}

export function ImpactReportModal({ prediction, managementChat, citizenChat, onClose, onSelectNode }: ImpactReportModalProps) {
  const [domainAgentRunning, setDomainAgentRunning] = useState(true);
  const [mitigationAgentRunning, setMitigationAgentRunning] = useState(true);
  const [activeTab, setActiveTab] = useState<"management" | "citizen">("management");
  return (
    <div className="bento-overlay" onClick={onClose}>
      <div className="bento-grid" onClick={(e) => e.stopPropagation()}>

        {/* ── LEFT COLUMN ─────────────────────────────── */}
        <div className="bento-col bento-col--left">

          {/* TILE 1: Header */}
          <div className="bento-tile bento-tile--header">
            <div className="bento-tile__header-row">
              <span className="bento-badge">AI Predictive Resilience Assessment</span>
              <button className="bento-close-btn" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <h2 className="bento-title">Cascade Blast Radius: {prediction.target_node_name}</h2>
            <p className="bento-subtitle">
              Injected failure: <span className="bento-highlight">{prediction.severity.toUpperCase()}</span> severity
              · Estimated radius: <span className="bento-highlight">{prediction.blast_radius_km} km</span>
            </p>
          </div>

          {/* TILE 2: KPIs */}
          <div className="bento-tile bento-tile--kpis">
            <div className="bento-kpi">
              <span className="bento-kpi__label">Blast Radius</span>
              <span className="bento-kpi__value">{prediction.blast_radius_km} <small>km</small></span>
              <span className="bento-kpi__sub">Geographic propagation</span>
            </div>
            <div className="bento-kpi">
              <span className="bento-kpi__label">Assets At Risk</span>
              <span className="bento-kpi__value">{prediction.total_assets_at_risk}</span>
              <span className="bento-kpi__sub">Downstream infrastructure</span>
            </div>
            <div className="bento-kpi bento-kpi--critical">
              <span className="bento-kpi__label">Critical Threatened</span>
              <span className="bento-kpi__value">{prediction.critical_assets_at_risk}</span>
              <span className="bento-kpi__sub">Hospitals &amp; substations</span>
            </div>
            <div className="bento-kpi">
              <span className="bento-kpi__label">Risk Index</span>
              <span className="bento-kpi__value">{prediction.priority_weighted_risk_score}</span>
              <span className="bento-kpi__sub">Priority-weighted NSU</span>
            </div>
          </div>

          {/* TILE 3: Executive Summary */}
          <div className="bento-tile bento-tile--narrative">
            <div className="bento-narrative-icon">🧠</div>
            <div>
              <strong className="bento-narrative-title">Executive Resilience Intelligence</strong>
              <p className="bento-narrative-body">{prediction.executive_summary}</p>
            </div>
          </div>

          {/* TILE 4: Ranked Assets */}
          <div className="bento-tile bento-tile--assets">
            <h3 className="bento-section-label">Ranked Affected Assets ({prediction.affected_nodes.length})</h3>
            <div className="bento-assets-list">
              {prediction.affected_nodes.map((node, index) => {
                const color = DOMAIN_COLOR[node.domain];
                const isFailed = node.predicted_state === "failed";
                const isDegraded = node.predicted_state === "degraded";
                return (
                  <div
                    key={node.id}
                    className={`bento-asset-row ${node.id === prediction.target_node_id ? "bento-asset-row--root" : ""}`}
                    onClick={() => { if (onSelectNode) { onSelectNode(node.id); onClose(); } }}
                  >
                    <span className="bento-asset-rank">#{index + 1}</span>
                    <span className="bento-asset-icon" style={{ background: color + "22", color }}>{DOMAIN_ICON[node.domain]}</span>
                    <div className="bento-asset-info">
                      <span className="bento-asset-name">{node.name}</span>
                      <span className="bento-asset-reason">{node.causal_reason}</span>
                    </div>
                    <div className="bento-asset-right">
                      <span className="bento-asset-pct">{Math.round(node.failure_probability * 100)}%</span>
                      <span className={`bento-state-badge ${isFailed ? "state-failed" : isDegraded ? "state-degraded" : "state-risk"}`}>
                        {node.predicted_state.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bento-footer-row">
              <span className="bento-footer-note">Model: <strong>M3-NSU-Probabilistic-0.2</strong></span>
              <button className="bento-back-btn" onClick={onClose}>Back to Map</button>
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────── */}
        <div className="bento-col bento-col--right">

          {/* TILE 5: Cross-Domain Breakdown */}
          <div className="bento-tile bento-tile--domains">
            <h3 className="bento-section-label">
              <span className={`agent-status-indicator ${domainAgentRunning ? "agent-status-indicator--running" : "agent-status-indicator--done"}`} />
              Agent Generated: Cross-Domain Breakdown
              {domainAgentRunning && <span className="bento-badge bento-badge--computing">Analyzing</span>}
            </h3>

            {domainAgentRunning ? (
              <AgentRunningView
                type="domain"
                agentName="Topology Agent"
                steps={[
                  "Pinging infrastructure grid telemetry...",
                  "Tracing cross-domain dependency links...",
                  "Evaluating cascading load transfer physics...",
                  "Synthesizing domain disruption percentages...",
                ]}
                durationMs={5200}
                onComplete={() => setDomainAgentRunning(false)}
              />
            ) : (
              <div className="bento-domains-list animate-fade-in">
                {prediction.domain_breakdowns.map((d) => {
                  const color = DOMAIN_COLOR[d.domain];
                  const pct = Math.round(d.average_disruption * 100);
                  return (
                    <div key={d.domain} className="bento-domain-row">
                      <div className="bento-domain-left">
                        <span className="bento-domain-icon">{DOMAIN_ICON[d.domain]}</span>
                        <span className="bento-domain-name">{d.domain.replace("_", " ").toUpperCase()}</span>
                      </div>
                      <div className="bento-domain-center">
                        <div className="bento-domain-bar-track">
                          <div className="bento-domain-bar-fill" style={{ width: `${Math.min(100, Math.max(4, pct))}%`, background: color }} />
                        </div>
                        <span className="bento-domain-stat">{d.disrupted_count}/{d.total_count} assets · {pct}% loss</span>
                      </div>
                      <span className={`bento-domain-status status-${d.status}`}>{d.status.toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* TILE 6: AI Mitigation */}
          <div className="bento-tile bento-tile--mitigation">
            <h3 className="bento-section-label" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span className={`agent-status-indicator ${mitigationAgentRunning ? "agent-status-indicator--running" : "agent-status-indicator--done"}`} />
              Agent Generated Response
              {mitigationAgentRunning && <span className="bento-badge bento-badge--computing">LLM Agent Generating</span>}
            </h3>

            {!mitigationAgentRunning && (
              <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
                <button
                  style={{ flex: 1, padding: "6px 8px", background: activeTab === "management" ? "#333" : "transparent", border: "1px solid #444", borderRadius: "4px", color: "white", cursor: "pointer" }}
                  onClick={() => setActiveTab("management")}
                >
                  Management Briefing
                </button>
                <button
                  style={{ flex: 1, padding: "6px 8px", background: activeTab === "citizen" ? "#333" : "transparent", border: "1px solid #444", borderRadius: "4px", color: "white", cursor: "pointer" }}
                  onClick={() => setActiveTab("citizen")}
                >
                  Citizen Advisory
                </button>
              </div>
            )}

            {mitigationAgentRunning ? (
              <AgentRunningView
                type="mcts"
                agentName="Multi-Agent System"
                steps={[
                  "Initializing MCTS state tree at ground zero...",
                  "Simulating downstream cascade rollouts...",
                  "Generating Management Briefing...",
                  "Synthesizing Citizen Engagement Alert...",
                ]}
                durationMs={12000} // Increased duration to accommodate LLM waiting time visually
                onComplete={() => setMitigationAgentRunning(false)}
              />
            ) : (
              <div className="bento-mitigation-content animate-fade-in" style={{ flex: 1, overflowY: "auto", paddingRight: "8px" }}>
                {activeTab === "management" && (
                  managementChat ? (
                    <AgentMarkdown text={managementChat.response} />
                  ) : <p className="bento-mitigation-intro">Management Briefing unavailable. Was Groq API key set?</p>
                )}

                {activeTab === "citizen" && (
                  citizenChat ? (
                    <AgentMarkdown text={citizenChat.response} />
                  ) : <p className="bento-mitigation-intro">Citizen Advisory unavailable. Was Groq API key set?</p>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
