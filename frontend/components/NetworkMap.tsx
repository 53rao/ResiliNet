"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Domain, NetworkGraph } from "@/lib/types";
import type { PlaybackNodeState } from "@/lib/playback";

/* ── domain config ────────────────────────────────────────────── */
const DOMAIN_COLOR: Record<Domain, string> = {
  power:        "#4ade80",
  water:        "#38bdf8",
  traffic:      "#818cf8",
  healthcare:   "#f87171",
  public_safety:"#fb923c",
};

const DOMAIN_ICON: Record<Domain, string> = {
  power:        "⚡",
  water:        "💧",
  traffic:      "🌉",
  healthcare:   "✚",
  public_safety:"🚑",
};

/* ── state → CSS class mapping ───────────────────────────────── */
function stateClass(s: string) {
  return s === "failed" ? "mk-failed" : s === "degraded" ? "mk-degraded" : s === "stressed" ? "mk-stressed" : "";
}

interface NetworkMapProps {
  graph: NetworkGraph;
  selectedNodeId: string | null;
  playbackNodes: Record<string, PlaybackNodeState>;
  activeEdgeIds: string[];
  visibleDomains: Domain[];
  showDependencies: boolean;
  onSelectNode: (nodeId: string) => void;
  isReportOpen?: boolean;
}

function esc(v: string) {
  return v.replace(/[&<>'"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" })[c] ?? c);
}

export function NetworkMap({
  graph,
  selectedNodeId,
  playbackNodes,
  activeEdgeIds,
  visibleDomains,
  onSelectNode,
  isReportOpen,
}: NetworkMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const layerRef     = useRef<L.LayerGroup | null>(null);
  const { south, west, north, east } = graph.locality.bounding_box;

  /* ── initialise map once ──────────────────────────────────── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      attributionControl: false,
      zoomControl: false,
      minZoom: 10,
      maxZoom: 18,
    });

    // Fit to bounding box with some padding for the UI elements
    map.fitBounds([[south, west], [north, east]], {
      paddingTopLeft: [60, 90],
      paddingBottomRight: [60, 60],
    });

    // ESRI World Imagery — free satellite tiles, no token required
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles © Esri" }
    ).addTo(map);

    // Clean reference labels overlay matching ESRI imagery
    L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18, opacity: 0.45 }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.attribution({ position: "bottomright", prefix: false })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | © <a href="https://www.esri.com">Esri</a>')
      .addTo(map);

    const layer = L.layerGroup().addTo(map);
    mapRef.current  = map;
    layerRef.current = layer;

    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(containerRef.current!);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current  = null;
      layerRef.current = null;
    };
  }, [east, north, south, west]);

  /* ── animate to node on report open ────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedNodeId) return;

    const node = graph.nodes.find((n) => n.id === selectedNodeId);
    if (node && isReportOpen) {
      if (mapRef.current) {
        mapRef.current.invalidateSize({ animate: false });
        mapRef.current.flyTo([node.location.lat, node.location.lng], 14, { duration: 1.2, easeLinearity: 0.25 });
      }
    }
  }, [isReportOpen, selectedNodeId, graph]);

  /* ── redraw nodes + edges on state changes ────────────────── */
  useEffect(() => {
    const map   = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const visible    = new Set(visibleDomains);
    const activeSet  = new Set(activeEdgeIds);
    const byId       = new Map(graph.nodes.map(n => [n.id, n]));

    /* draw edges */
    for (const edge of graph.edges) {
      const s = byId.get(edge.source);
      const t = byId.get(edge.target);
      if (!s || !t || !visible.has(s.domain) || !visible.has(t.domain)) continue;
      const active = activeSet.has(edge.id);
      const show   = active || s.id === selectedNodeId || t.id === selectedNodeId;
      if (!show) continue;

      L.polyline(
        [[s.location.lat, s.location.lng], [t.location.lat, t.location.lng]],
        {
          color: active ? "#ff6b6b" : "rgba(200,220,240,0.35)",
          weight: active ? 2.5 : 1.2,
          opacity: active ? 0.85 : 0.5,
          dashArray: active ? undefined : "5 8",
          className: active ? "edge-active" : undefined,
        }
      ).addTo(layer);
    }

    /* draw markers */
    for (const node of graph.nodes) {
      if (!visible.has(node.domain)) continue;
      const pb       = playbackNodes[node.id];
      const state    = pb?.state ?? "normal";
      const selected = node.id === selectedNodeId;
      const color    = DOMAIN_COLOR[node.domain];
      const icon     = DOMAIN_ICON[node.domain];

      const html = `
        <div class="geo-marker ${stateClass(state)} ${selected ? "geo-marker--selected" : ""}" style="--mk-color:${color}">
          <div class="geo-marker__icon">${icon}</div>
          <span class="geo-marker__label">${esc(node.name)}</span>
        </div>
      `;

      const divIcon = L.divIcon({
        className: "geo-marker-wrap",
        html,
        iconSize:   [0, 0],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([node.location.lat, node.location.lng], {
        icon: divIcon,
        title: node.name,
        alt:   `Select ${node.name}`,
        zIndexOffset: selected ? 1000 : 0,
      });

      marker.on("click", () => onSelectNode(node.id));
      marker.addTo(layer);
    }
  }, [activeEdgeIds, graph, onSelectNode, playbackNodes, selectedNodeId, visibleDomains]);

  return (
    <div ref={containerRef} className="map-canvas" />
  );
}
