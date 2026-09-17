"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PulseIcon } from "@/components/Icons";
import { fetchGraph, runCascade, predictImpact, type DemoRun } from "@/lib/api";
import { createInitialPlaybackState, getStepMetrics, playbackReducer } from "@/lib/playback";
import type { Domain, NetworkGraph, ImpactPrediction } from "@/lib/types";
import { ImpactReportModal } from "@/components/ImpactReportModal";

const NetworkMap = dynamic(
  () => import("@/components/NetworkMap").then(m => m.NetworkMap),
  { ssr: false }
);

const DOMAINS: { id: Domain; label: string; icon: string }[] = [
  { id: "healthcare",   label: "Hospitals",   icon: "✚" },
  { id: "traffic",      label: "Transport",   icon: "🌉" },
  { id: "power",        label: "Power",       icon: "⚡" },
  { id: "water",        label: "Water",       icon: "💧" },
  { id: "public_safety",label: "Emergency",   icon: "🚑" },
];

const DOMAIN_COLOR: Record<Domain, string> = {
  power:         "#4ade80",
  water:         "#38bdf8",
  traffic:       "#818cf8",
  healthcare:    "#f87171",
  public_safety: "#fb923c",
};

const DOMAIN_LABEL: Record<Domain, string> = {
  power:         "Power",
  water:         "Water",
  traffic:       "Transport",
  healthcare:    "Healthcare",
  public_safety: "Emergency",
};

const CLOCK_FORMAT: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" };

function useClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("en-GB", CLOCK_FORMAT));
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString("en-GB", CLOCK_FORMAT));
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function DashboardShell() {
  const clock = useClock();

  const [graph, setGraph]       = useState<NetworkGraph | null>(null);
  const [error, setError]       = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe">("severe");
  const [duration, setDuration] = useState(6);
  const [visible, setVisible]   = useState<Domain[]>(DOMAINS.map(d => d.id));
  const [run, setRun]           = useState<DemoRun | null>(null);
  const [busy, setBusy]         = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prediction, setPrediction] = useState<ImpactPrediction | null>(null);
  const [managementChat, setManagementChat] = useState<any>(null);
  const [citizenChat, setCitizenChat] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);

  const [playback, dispatch] = useReducer(playbackReducer, undefined, createInitialPlaybackState);
  const controller = useRef<AbortController | null>(null);

  /* ── load graph ──────────────────────────────────────────── */
  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      setGraph(await fetchGraph(signal));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setError(e instanceof Error ? e.message : "Unable to load network");
    }
  }, []);

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => { c.abort(); controller.current?.abort(); };
  }, [load]);

  /* ── playback timer ──────────────────────────────────────── */
  useEffect(() => {
    if (playback.status !== "playing" || !run) return;
    const t = window.setTimeout(() => dispatch({ type: "tick", events: run.events }), 1200);
    return () => window.clearTimeout(t);
  }, [playback.status, playback.cursor, run]);

  /* ── keyboard ────────────────────────────────────────────── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showReport) setShowReport(false);
        else setSelectedId(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [showReport]);

  const selected     = graph?.nodes.find(n => n.id === selectedId);
  const dependencies = useMemo(
    () => graph?.edges.filter(e => e.kind === "dependency" && (e.source === selectedId || e.target === selectedId)) ?? [],
    [graph, selectedId]
  );
  const metrics = getStepMetrics(playback, graph);

  const selectNode = useCallback((id: string) => setSelectedId(id), []);

  const reset = () => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setRun(null);
    setError("");
    dispatch({ type: "reset" });
  };

  const start = async () => {
    if (!graph || !selected || busy) return;
    const c = new AbortController();
    controller.current?.abort();
    controller.current = c;
    setBusy(true);
    setError("");
    setRun(null);
    dispatch({ type: "reset" });
    try {
      const [result, pred, mgmtChat, citizenChat] = await Promise.all([
        runCascade(
          { graph_version: graph.graph_version, node_id: selected.id, severity, duration_steps: duration, seed: 20260915 },
          c.signal
        ),
        predictImpact(
          { graph_version: graph.graph_version, node_id: selected.id, severity, duration_steps: duration },
          c.signal
        ).catch(err => {
          console.error("Prediction failed:", err);
          return null;
        }),
        import("@/lib/api").then(api => api.runAgentChat(
          { node_id: selected.id, severity, budget: 2, agent_type: "management" },
          c.signal
        )).catch(err => {
          console.error("Management Chat failed:", err);
          return null;
        }),
        import("@/lib/api").then(api => api.runAgentChat(
          { node_id: selected.id, severity, budget: 2, agent_type: "citizen" },
          c.signal
        )).catch(err => {
          console.error("Citizen Chat failed:", err);
          return null;
        })
      ]);
      if (controller.current !== c) return;
      setRun(result);
      if (pred) {
        setPrediction(pred);

        // Pass chats to ImpactReportModal
        setManagementChat(mgmtChat);
        setCitizenChat(citizenChat);

        setShowReport(true);
      }
      dispatch({ type: "start", events: result.events });
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      if (controller.current === c) setBusy(false);
    }
  };

  const simStatus = run
    ? (playback.status === "playing"
        ? `Wave ${playback.cursor ?? 0} propagating…`
        : playback.status === "complete"
        ? `Cascade complete · ${metrics.affected_assets} assets affected`
        : `Paused · Wave ${playback.cursor ?? 0}`)
    : "All Systems Nominal";

  /* ── render ──────────────────────────────────────────────── */
  return (
    <div className="shell">
      {/* ── full-screen map background ── */}
      <div className={`map-layer ${showReport ? "map-layer--report-open" : ""}`}>
        {graph && (
          <NetworkMap
            graph={graph}
            selectedNodeId={selectedId}
            playbackNodes={playback.nodes}
            activeEdgeIds={playback.activeEdgeIds}
            visibleDomains={visible}
            showDependencies
            onSelectNode={selectNode}
            isReportOpen={showReport}
          />
        )}
        {!graph && !error && (
          <div className="map-loading">
            <span className="map-loading__spinner" />
            <p>Loading London network…</p>
          </div>
        )}
      </div>

      {/* ── top bar ── */}
      <header className="topbar">
        <div className="topbar__brand">
          <span className="topbar__icon"><PulseIcon /></span>
          <div>
            <p className="topbar__name">ResiliNet</p>
            <p className="topbar__tagline">Stronger Cities. Safer Tomorrows.</p>
          </div>
        </div>

        <div className="topbar__meta">
          <div className="topbar__pill">
            <span className="topbar__pill-icon">📍</span>
            <span>London, UK</span>
          </div>
          <div className="topbar__pill">
            <span className="topbar__pill-icon">🕐</span>
            <span>{clock}</span>
          </div>
          <div className={`topbar__status ${run ? "topbar__status--active" : ""}`}>
            <span className="status-dot" />
            <span>{simStatus}</span>
          </div>
        </div>
      </header>

      {/* ── left sidebar toggle ── */}
      <div className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <button
          className="sidebar__toggle"
          onClick={() => setSidebarOpen(v => !v)}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <span className="sidebar__toggle-arrow">{sidebarOpen ? "‹" : "›"}</span>
        </button>

        {sidebarOpen && (
          <nav className="sidebar__nav">
            <p className="sidebar__section-label">Layers</p>
            {DOMAINS.map(d => (
              <button
                key={d.id}
                className={`sidebar__layer-btn ${visible.includes(d.id) ? "sidebar__layer-btn--on" : ""}`}
                style={{ "--lc": DOMAIN_COLOR[d.id] } as React.CSSProperties}
                onClick={() =>
                  setVisible(v =>
                    v.includes(d.id) ? v.filter(x => x !== d.id) : [...v, d.id]
                  )
                }
                aria-pressed={visible.includes(d.id)}
              >
                <span className="sidebar__layer-icon">{d.icon}</span>
                <span className="sidebar__layer-label">{d.label}</span>
              </button>
            ))}

            {run && (
              <>
                <p className="sidebar__section-label" style={{ marginTop: 18 }}>Playback</p>
                <div className="sidebar__playback">
                  <button
                    className="sidebar__pb-btn"
                    disabled={!run || playback.status === "playing"}
                    onClick={() => run && dispatch({ type: playback.status === "paused" ? "resume" : "start", events: run.events })}
                  >
                    {playback.status === "paused" ? "▶ Resume" : "▶ Replay"}
                  </button>
                  <button
                    className="sidebar__pb-btn"
                    disabled={playback.status !== "playing"}
                    onClick={() => dispatch({ type: "pause" })}
                  >⏸ Pause</button>
                  <button className="sidebar__pb-btn sidebar__pb-btn--reset" onClick={reset}>↺ Reset</button>
                </div>
              </>
            )}
          </nav>
        )}
      </div>

      {/* ── node popup card ── */}
      {selected && !showReport && (
        <aside className="node-card" key={selected.id}>
          <button className="node-card__close" onClick={() => setSelectedId(null)} aria-label="Close">×</button>

          {/* domain badge */}
          <div
            className="node-card__badge"
            style={{ background: DOMAIN_COLOR[selected.domain] + "22", color: DOMAIN_COLOR[selected.domain], border: `1px solid ${DOMAIN_COLOR[selected.domain]}55` }}
          >
            {DOMAIN_LABEL[selected.domain]} · {selected.type.replaceAll("_", " ")}
          </div>

          <h2 className="node-card__name">{selected.name}</h2>

          <div className="node-card__stats">
            <div className="node-card__stat">
              <span className="node-card__stat-label">Priority</span>
              <span
                className="node-card__stat-value"
                style={{
                  color:
                    selected.priority === "critical"
                      ? "#f87171"
                      : selected.priority === "high"
                      ? "#fb923c"
                      : selected.priority === "medium"
                      ? "#fbbf24"
                      : "#34d399",
                }}
              >
                {selected.priority}
              </span>
            </div>
            <div className="node-card__stat">
              <span className="node-card__stat-label">Load</span>
              <span className="node-card__stat-value">{selected.base_load} NSU</span>
            </div>
            <div className="node-card__stat">
              <span className="node-card__stat-label">Capacity</span>
              <span className="node-card__stat-value">{selected.capacity} NSU</span>
            </div>
            <div className="node-card__stat">
              <span className="node-card__stat-label">Utilisation</span>
              <span className="node-card__stat-value">{Math.round(selected.base_load / selected.capacity * 100)}%</span>
            </div>
          </div>

          {/* utilisation bar */}
          <div className="node-card__bar-track">
            <div
              className="node-card__bar-fill"
              style={{
                width: `${Math.round(selected.base_load / selected.capacity * 100)}%`,
                background: DOMAIN_COLOR[selected.domain],
              }}
            />
          </div>

          <div className="node-card__state">
            Current state: <strong>{playback.nodes[selected.id]?.state ?? "normal"}</strong>
          </div>

          <div className="node-card__divider" />

          {/* simulation controls */}
          <label className="node-card__label" htmlFor="severity-select">Failure severity</label>
          <select
            id="severity-select"
            className="node-card__select"
            value={severity}
            disabled={busy}
            onChange={e => setSeverity(e.target.value as typeof severity)}
          >
            <option value="mild">Mild · 25% disruption</option>
            <option value="moderate">Moderate · 55% disruption</option>
            <option value="severe">Severe · 100% disruption</option>
          </select>

          <label className="node-card__label" htmlFor="duration-range">
            Scenario horizon · <strong>{duration}</strong> steps
          </label>
          <input
            id="duration-range"
            className="node-card__range"
            type="range"
            min={1}
            max={12}
            value={duration}
            disabled={busy}
            onChange={e => setDuration(Number(e.target.value))}
          />

          <div className="node-card__actions">
            <button
              className="node-card__run-btn"
              disabled={busy}
              onClick={() => void start()}
              style={{ "--btn-color": DOMAIN_COLOR[selected.domain] } as React.CSSProperties}
            >
              {busy ? (
                <><span className="btn-spinner" /> Computing cascade…</>
              ) : (
                "▶  Run Simulation"
              )}
            </button>
          </div>

          {dependencies.length > 0 && (
            <details className="node-card__deps">
              <summary>Dependencies ({dependencies.length})</summary>
              <ul>
                {dependencies.map(e => {
                  const other = graph?.nodes.find(n => n.id === (e.source === selected.id ? e.target : e.source));
                  return (
                    <li key={e.id}>
                      <span>{e.source === selected.id ? "→ Supplies" : "← Depends on"}</span>
                      <strong>{other?.name ?? e.source}</strong>
                      <small>weight {e.weight.toFixed(2)}</small>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          {selected.osm && (
            <a className="node-card__osm-link" href={selected.osm.url} target="_blank" rel="noreferrer">
              View on OpenStreetMap ↗
            </a>
          )}
        </aside>
      )}

      {/* ── bottom metrics strip ── */}
      {run && (
        <section className="metrics-strip">
          <div className="metrics-strip__inner">
            <div className="metrics-strip__info">
              <span className="metrics-strip__scenario">
                {graph?.nodes.find(n => n.id === run.input.node_id)?.name} · {run.input.severity}
              </span>
              <span className="metrics-strip__status">
                {busy ? "Computing…" : run.truncated ? "Step cap reached" : `Wave ${playback.cursor ?? 0} · ${playback.status}`}
              </span>
            </div>
            <div className="metrics-strip__stats">
              {[
                ["Affected",         metrics.affected_assets],
                ["Failed",           metrics.failed_assets],
                ["Critical hit",     metrics.affected_critical_assets],
                ["Wtd. damage",      metrics.priority_weighted_damage.toFixed(1)],
                ["Cascade depth",    metrics.propagation_depth],
              ].map(([label, value]) => (
                <div key={String(label)} className="metrics-strip__stat">
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="metrics-strip__playback">
              <button
                disabled={!run || playback.status === "playing"}
                onClick={() => run && dispatch({ type: playback.status === "paused" ? "resume" : "start", events: run.events })}
              >
                {playback.status === "paused" ? "▶" : "↺"}
              </button>
              <button disabled={playback.status !== "playing"} onClick={() => dispatch({ type: "pause" })}>⏸</button>
              <button
                disabled={!run || playback.status === "playing" || playback.status === "complete"}
                onClick={() => run && dispatch({ type: "step", events: run.events })}
              >⏭</button>
              <button onClick={reset} title="Reset">✕</button>
            </div>
            {prediction && (
              <button
                className="metrics-strip__report-btn"
                onClick={() => setShowReport(true)}
                title="View Impact & Prediction Report"
              >
                📊 Impact Report
              </button>
            )}
          </div>
          {playback.timeline.at(-1)?.reason && (
            <p className="metrics-strip__reason">{playback.timeline.at(-1)?.reason}</p>
          )}
        </section>
      )}

      {/* ── impact report modal ── */}
        {showReport && prediction && (
          <ImpactReportModal
            prediction={prediction}
            managementChat={managementChat}
            citizenChat={citizenChat}
            onClose={() => setShowReport(false)}
            onSelectNode={selectNode}
          />
        )}



      {/* ── error toast ── */}
      {error && (
        <div className="error-toast" role="alert">
          <span>⚠ {error}</span>
          <button onClick={() => void load()}>Retry</button>
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}
    </div>
  );
}
