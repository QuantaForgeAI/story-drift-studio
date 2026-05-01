import type {
  Scenario,
  TimelineBranch,
  TimelineEvent,
  TopologyEdge,
  TopologyNode,
} from "@/data/scenarios";

export interface TimelineSnapshot {
  currentTime: number;
  activeEvents: TimelineEvent[];
  currentEvent: TimelineEvent | null;
  nodeStates: Map<string, TopologyNode["status"]>;
  progress: number;
  isComplete: boolean;
}

export interface TopologyState {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  nodeStates: Map<string, TopologyNode["status"]>;
  affectedNodes: string[];
}

export interface ScenarioState extends TimelineSnapshot {
  branches: TimelineBranch[];
  selectedBranch: TimelineBranch | null;
  topologyState: TopologyState;
}

function sortEvents(events: TimelineEvent[]) {
  return [...events].sort((left, right) => left.timestamp - right.timestamp);
}

export function clampTimelineTime(time: number, duration: number) {
  if (!Number.isFinite(time)) return 0;
  if (duration <= 0) return 0;
  return Math.min(Math.max(0, time), duration);
}

export function getActiveEvents(events: TimelineEvent[], time: number) {
  return sortEvents(events).filter((event) => event.timestamp <= time);
}

export function getCurrentEvent(events: TimelineEvent[], time: number) {
  const activeEvents = getActiveEvents(events, time);
  return activeEvents.at(-1) ?? null;
}

export function computeNodeStates(scenario: Scenario, time: number, events: TimelineEvent[] = scenario.events) {
  const states = new Map<string, TopologyNode["status"]>();

  scenario.nodes.forEach((node) => {
    states.set(node.id, node.status);
  });

  const pastEvents = getActiveEvents(events, time);

  for (const event of pastEvents) {
    if (event.type === "recovery" && event.affectedNodes.length === 0) {
      for (const node of scenario.nodes) {
        states.set(node.id, "healthy");
      }
      continue;
    }

    for (const nodeId of event.affectedNodes) {
      if (event.type === "failure" || event.type === "cascade") {
        states.set(nodeId, "down");
        continue;
      }

      if (event.type === "recovery") {
        states.set(nodeId, "healthy");
        continue;
      }

      if (states.get(nodeId) !== "down") {
        states.set(nodeId, "degraded");
      }
    }
  }

  return states;
}

export function buildTimelineBranches(scenario: Scenario): TimelineBranch[] {
  if (scenario.branches && scenario.branches.length > 0) {
    return scenario.branches;
  }

  return [
    {
      id: "main",
      label: "Primary path",
      description: "Primary scenario playback sequence",
      eventIds: scenario.events.map((event) => event.id),
    },
  ];
}

export function getScenarioBranch(scenario: Scenario, branchId: string | null): TimelineBranch | null {
  const branches = buildTimelineBranches(scenario);
  if (!branchId) {
    return branches.find((branch) => branch.id === scenario.currentBranchId) ?? branches[0] ?? null;
  }

  return branches.find((branch) => branch.id === branchId) ?? branches[0] ?? null;
}

export function filterEventsForBranch(events: TimelineEvent[], branch: TimelineBranch | null) {
  if (!branch) {
    return events;
  }

  const branchEventIds = new Set(branch.eventIds);
  return events.filter((event) => branchEventIds.has(event.id));
}

export function getTopologyState(
  scenario: Scenario,
  nodeStates: Map<string, TopologyNode["status"]>,
  activeEvents: TimelineEvent[],
): TopologyState {
  const affectedNodeSet = new Set(activeEvents.flatMap((event) => event.affectedNodes));
  return {
    nodes: scenario.nodes,
    edges: scenario.edges,
    nodeStates,
    affectedNodes: Array.from(affectedNodeSet),
  };
}

export function getScenarioState(
  scenario: Scenario,
  time: number,
  branchId: string | null = null,
): ScenarioState {
  const currentTime = clampTimelineTime(time, scenario.duration);
  const selectedBranch = getScenarioBranch(scenario, branchId);
  const branchEvents = filterEventsForBranch(scenario.events, selectedBranch);

  const activeEvents = getActiveEvents(branchEvents, currentTime);
  const currentEvent = activeEvents.at(-1) ?? null;
  const nodeStates = computeNodeStates(scenario, currentTime, branchEvents);

  return {
    currentTime,
    activeEvents,
    currentEvent,
    nodeStates,
    progress: scenario.duration > 0 ? currentTime / scenario.duration : 0,
    isComplete: currentTime >= scenario.duration,
    branches: buildTimelineBranches(scenario),
    selectedBranch,
    topologyState: getTopologyState(scenario, nodeStates, activeEvents),
  };
}

export function getTimelineSnapshot(
  scenario: Scenario,
  time: number,
  branchId: string | null = null,
): TimelineSnapshot {
  const state = getScenarioState(scenario, time, branchId);
  return {
    currentTime: state.currentTime,
    activeEvents: state.activeEvents,
    currentEvent: state.currentEvent,
    nodeStates: state.nodeStates,
    progress: state.progress,
    isComplete: state.isComplete,
  };
}

export function getNextTimelineTime(currentTime: number, speed: number, duration: number) {
  const safeSpeed = Number.isFinite(speed) ? Math.max(speed, 0) : 0;
  return clampTimelineTime(currentTime + safeSpeed, duration);
}
