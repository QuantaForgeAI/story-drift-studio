import { describe, expect, it } from "vitest";
import { scenarios, type Scenario } from "@/data/scenarios";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";
import {
  clampTimelineTime,
  computeNodeStates,
  getCurrentEvent,
  getNextTimelineTime,
  getTimelineSnapshot,
} from "@/lib/simulation-core";

const scenarioFixture: Scenario = {
  schemaVersion: SCENARIO_SCHEMA_VERSION,
  id: "fixture-1",
  name: "Fixture",
  subtitle: "Simulation core test fixture",
  severity: "high",
  duration: 120,
  nodes: [
    { id: "gateway", label: "Gateway", type: "gateway", x: 100, y: 40, status: "healthy" },
    { id: "api", label: "API", type: "service", x: 200, y: 120, status: "healthy" },
    { id: "db", label: "DB", type: "database", x: 320, y: 200, status: "healthy" },
  ],
  edges: [
    { from: "gateway", to: "api" },
    { from: "api", to: "db" },
  ],
  events: [
    {
      id: "evt-2",
      timestamp: 50,
      type: "failure",
      severity: "critical",
      title: "DB outage",
      description: "Database went down",
      affectedNodes: ["db"],
    },
    {
      id: "evt-1",
      timestamp: 10,
      type: "alert",
      severity: "medium",
      title: "API latency",
      description: "API started degrading",
      affectedNodes: ["api"],
    },
    {
      id: "evt-3",
      timestamp: 90,
      type: "recovery",
      severity: "low",
      title: "DB restored",
      description: "Database recovered",
      affectedNodes: ["db"],
    },
  ],
  narrative: {
    executiveSummary: "Fixture summary",
    technicalSummary: "Fixture technical summary",
    rootCause: "Fixture root cause",
    actions: ["Action 1"],
    impactScore: 75,
  },
};

const newScenarioIds = [
  "edge-certificate-expiry",
  "stream-schema-drift",
  "signing-key-rotation-outage",
  "feature-flag-runaway",
  "payment-provider-timeout-spiral",
  "object-storage-policy-lockout",
  "scheduler-fanout-storm",
  "replica-failover-split-brain",
  "vector-index-poisoning",
] as const;

describe("simulation core", () => {
  it("clamps timeline time into scenario bounds", () => {
    expect(clampTimelineTime(-5, 120)).toBe(0);
    expect(clampTimelineTime(40, 120)).toBe(40);
    expect(clampTimelineTime(400, 120)).toBe(120);
  });

  it("returns active events in timestamp order and picks the latest current event", () => {
    expect(getCurrentEvent(scenarioFixture.events, 5)).toBeNull();
    expect(getCurrentEvent(scenarioFixture.events, 30)?.id).toBe("evt-1");
    expect(getCurrentEvent(scenarioFixture.events, 75)?.id).toBe("evt-2");
  });

  it("computes node states across alert, failure, and recovery transitions", () => {
    expect(Array.from(computeNodeStates(scenarioFixture, 0).entries())).toEqual([
      ["gateway", "healthy"],
      ["api", "healthy"],
      ["db", "healthy"],
    ]);

    expect(Array.from(computeNodeStates(scenarioFixture, 20).entries())).toEqual([
      ["gateway", "healthy"],
      ["api", "degraded"],
      ["db", "healthy"],
    ]);

    expect(Array.from(computeNodeStates(scenarioFixture, 60).entries())).toEqual([
      ["gateway", "healthy"],
      ["api", "degraded"],
      ["db", "down"],
    ]);

    expect(Array.from(computeNodeStates(scenarioFixture, 100).entries())).toEqual([
      ["gateway", "healthy"],
      ["api", "degraded"],
      ["db", "healthy"],
    ]);
  });

  it("treats recovery events with no affected nodes as full system recovery", () => {
    const fullRecoveryScenario: Scenario = {
      ...scenarioFixture,
      id: "fixture-full-recovery",
      events: [
        {
          id: "evt-1",
          timestamp: 10,
          type: "failure",
          severity: "critical",
          title: "API outage",
          description: "API went down",
          affectedNodes: ["api"],
        },
        {
          id: "evt-2",
          timestamp: 20,
          type: "recovery",
          severity: "low",
          title: "System normalized",
          description: "Recovery completed",
          affectedNodes: [],
        },
      ],
    };

    expect(Array.from(computeNodeStates(fullRecoveryScenario, 25).entries())).toEqual([
      ["gateway", "healthy"],
      ["api", "healthy"],
      ["db", "healthy"],
    ]);
  });

  it("returns a deterministic timeline snapshot and next playback step", () => {
    const snapshot = getTimelineSnapshot(scenarioFixture, 55);
    expect(snapshot.currentTime).toBe(55);
    expect(snapshot.currentEvent?.id).toBe("evt-2");
    expect(snapshot.activeEvents.map((event) => event.id)).toEqual(["evt-1", "evt-2"]);
    expect(snapshot.progress).toBeCloseTo(55 / 120);
    expect(snapshot.isComplete).toBe(false);

    expect(getNextTimelineTime(55, 3, 120)).toBe(58);
    expect(getNextTimelineTime(118, 5, 120)).toBe(120);
  });

  it("returns all newly added scenarios to a fully healthy final state", () => {
    const failures = newScenarioIds.flatMap((scenarioId) => {
      const scenario = scenarios.find((entry) => entry.id === scenarioId);

      expect(scenario).toBeDefined();

      const snapshot = getTimelineSnapshot(scenario!, scenario!.duration);
      const nonHealthyNodes = scenario!.nodes
        .map((node) => ({ id: node.id, status: snapshot.nodeStates.get(node.id) }))
        .filter((node) => node.status !== "healthy")
        .map((node) => `${scenarioId}:${node.id}=${node.status}`);

      return nonHealthyNodes;
    });

    expect(failures).toEqual([]);
  });
});
