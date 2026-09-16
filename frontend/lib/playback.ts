import type {
  CascadeEvent,
  CascadeMetrics,
  NetworkGraph,
  OperationalState,
} from "@/lib/types";


export type PlaybackStatus = "idle" | "playing" | "paused" | "complete";

export interface PlaybackNodeState {
  state: OperationalState;
  disruption: number;
  eventId: string;
  step: number;
}

export interface PlaybackState {
  status: PlaybackStatus;
  cursor: number;
  currentStep: number | null;
  nodes: Record<string, PlaybackNodeState>;
  activeEdgeIds: string[];
  timeline: CascadeEvent[];
}

export type PlaybackAction =
  | { type: "start"; events: CascadeEvent[] }
  | { type: "pause" }
  | { type: "resume"; events: CascadeEvent[] }
  | { type: "tick"; events: CascadeEvent[] }
  | { type: "step"; events: CascadeEvent[] }
  | { type: "reset" };


export function createInitialPlaybackState(): PlaybackState {
  return {
    status: "idle",
    cursor: 0,
    currentStep: null,
    nodes: {},
    activeEdgeIds: [],
    timeline: [],
  };
}


function applyNextWave(
  state: PlaybackState,
  events: CascadeEvent[],
  continuingStatus: "playing" | "paused",
): PlaybackState {
  const firstEvent = events[state.cursor];
  if (!firstEvent) return { ...state, status: "complete", activeEdgeIds: [] };

  const step = firstEvent.step;
  const wave: CascadeEvent[] = [];
  let nextCursor = state.cursor;
  while (events[nextCursor]?.step === step) {
    wave.push(events[nextCursor]);
    nextCursor += 1;
  }

  const nodes = { ...state.nodes };
  for (const event of wave) {
    nodes[event.node_id] = {
      state: event.new_state,
      disruption: event.new_disruption,
      eventId: event.event_id,
      step: event.step,
    };
  }

  return {
    status: nextCursor >= events.length ? "complete" : continuingStatus,
    cursor: nextCursor,
    currentStep: step,
    nodes,
    activeEdgeIds: [...new Set(wave.flatMap((event) => event.cause_edge_ids))],
    timeline: [...state.timeline, ...wave],
  };
}


export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "start":
      return applyNextWave(createInitialPlaybackState(), action.events, "playing");
    case "resume":
      return state.status === "paused" ? { ...state, status: "playing" } : state;
    case "pause":
      return state.status === "playing" ? { ...state, status: "paused" } : state;
    case "tick":
      return state.status === "playing" ? applyNextWave(state, action.events, "playing") : state;
    case "step":
      return state.status === "complete" ? state : applyNextWave(state, action.events, "paused");
    case "reset":
      return createInitialPlaybackState();
  }
}


export function getStepMetrics(state: PlaybackState, graph: NetworkGraph | null): CascadeMetrics {
  const affected = Object.entries(state.nodes).filter(([, value]) => value.disruption > 0);
  if (!graph) {
    return {
      affected_assets: affected.length,
      failed_assets: affected.filter(([, value]) => value.state === "failed").length,
      affected_critical_assets: 0,
      priority_weighted_damage: 0,
      propagation_depth: state.currentStep ?? 0,
    };
  }

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    affected_assets: affected.length,
    failed_assets: affected.filter(([, value]) => value.state === "failed").length,
    affected_critical_assets: affected.filter(([nodeId]) => byId.get(nodeId)?.priority === "critical").length,
    priority_weighted_damage: Number(
      affected.reduce((total, [nodeId, value]) => {
        return total + (byId.get(nodeId)?.priority_weight ?? 0) * value.disruption;
      }, 0).toFixed(4),
    ),
    propagation_depth: state.currentStep ?? 0,
  };
}
