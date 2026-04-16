import type { Scenario, TimelineEvent, TopologyNode } from "@/data/scenarios";

export interface TimelineSnapshot {
  currentTime: number;
  activeEvents: TimelineEvent[];
  currentEvent: TimelineEvent | null;
  nodeStates: Map<string, TopologyNode["status"]>;
  progress: number;
  isComplete: boolean;
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

export function computeNodeStates(scenario: Scenario, time: number) {
  const states = new Map<string, TopologyNode["status"]>();

  scenario.nodes.forEach((node) => {
    states.set(node.id, node.status);
  });

  const pastEvents = getActiveEvents(scenario.events, time);

  for (const event of pastEvents) {
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

export function getTimelineSnapshot(scenario: Scenario, time: number): TimelineSnapshot {
  const currentTime = clampTimelineTime(time, scenario.duration);
  const activeEvents = getActiveEvents(scenario.events, currentTime);

  return {
    currentTime,
    activeEvents,
    currentEvent: activeEvents.at(-1) ?? null,
    nodeStates: computeNodeStates(scenario, currentTime),
    progress: scenario.duration > 0 ? currentTime / scenario.duration : 0,
    isComplete: currentTime >= scenario.duration,
  };
}

export function getNextTimelineTime(currentTime: number, speed: number, duration: number) {
  const safeSpeed = Number.isFinite(speed) ? Math.max(speed, 0) : 0;
  return clampTimelineTime(currentTime + safeSpeed, duration);
}
