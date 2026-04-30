import { describe, expect, it } from "vitest";
import type { Scenario } from "@/data/scenarios";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";
import {
  compareReplaySnapshots,
  compareScenarioVersions,
} from "@/lib/scenarioComparison";
import type { ScenarioBackendReplaySnapshot } from "@/lib/scenarioBackendModels";
import type { ScenarioVersionRecord } from "@/lib/scenarioWorkspace";

const baseScenario: Scenario = {
  schemaVersion: SCENARIO_SCHEMA_VERSION,
  id: "compare-fixture",
  name: "Checkout Drift",
  subtitle: "Base revision",
  severity: "medium",
  duration: 120,
  nodes: [
    { id: "gateway", label: "Gateway", type: "gateway", x: 120, y: 80, status: "healthy" },
    { id: "api", label: "API", type: "service", x: 280, y: 180, status: "healthy" },
    { id: "db", label: "Database", type: "database", x: 440, y: 300, status: "healthy" },
  ],
  edges: [
    { from: "gateway", to: "api" },
    { from: "api", to: "db" },
  ],
  events: [
    {
      id: "evt-1",
      timestamp: 10,
      type: "drift",
      severity: "medium",
      title: "Latency drift",
      description: "API latency is rising",
      affectedNodes: ["api"],
    },
    {
      id: "evt-2",
      timestamp: 40,
      type: "failure",
      severity: "high",
      title: "Database saturation",
      description: "Connections are exhausted",
      affectedNodes: ["db"],
    },
  ],
  narrative: {
    executiveSummary: "Base executive summary",
    technicalSummary: "Base technical summary",
    rootCause: "Base root cause",
    actions: ["Investigate API", "Scale database"],
    impactScore: 52,
  },
};

const targetScenario: Scenario = {
  ...baseScenario,
  subtitle: "Target revision",
  severity: "high",
  duration: 150,
  nodes: [
    { id: "gateway", label: "Gateway", type: "gateway", x: 120, y: 80, status: "healthy" },
    { id: "api", label: "Checkout API", type: "service", x: 320, y: 180, status: "degraded" },
    { id: "db", label: "Database", type: "database", x: 440, y: 300, status: "healthy" },
    { id: "queue", label: "Queue", type: "queue", x: 560, y: 220, status: "healthy" },
  ],
  edges: [
    { from: "gateway", to: "api" },
    { from: "api", to: "db" },
    { from: "api", to: "queue", animated: true },
  ],
  events: [
    {
      id: "evt-1",
      timestamp: 12,
      type: "drift",
      severity: "high",
      title: "Latency drift",
      description: "API latency is rising faster",
      affectedNodes: ["api", "queue"],
    },
    {
      id: "evt-3",
      timestamp: 65,
      type: "cascade",
      severity: "critical",
      title: "Queue backlog",
      description: "The queue is backing up",
      affectedNodes: ["queue"],
    },
  ],
  narrative: {
    executiveSummary: "Target executive summary",
    technicalSummary: "Base technical summary",
    rootCause: "Updated root cause",
    actions: ["Investigate API", "Scale database", "Drain queue"],
    impactScore: 74,
  },
};

const baseVersion: ScenarioVersionRecord = {
  id: "version-base",
  revision: 1,
  createdAt: "2026-04-23T09:00:00.000Z",
  source: "builder",
  scenario: baseScenario,
};

const targetVersion: ScenarioVersionRecord = {
  id: "version-target",
  revision: 2,
  createdAt: "2026-04-23T09:10:00.000Z",
  source: "import",
  scenario: targetScenario,
};

const baseSnapshot: ScenarioBackendReplaySnapshot = {
  id: "snapshot-base",
  organizationId: "org-story-drift-labs",
  scenarioId: baseScenario.id,
  scenarioVersionId: baseVersion.id,
  trigger: "share",
  currentTime: 40,
  activeEventIds: ["evt-1", "evt-2"],
  nodeStates: {
    gateway: "healthy",
    api: "degraded",
    db: "down",
  },
  createdAt: "2026-04-23T09:15:00.000Z",
};

const targetSnapshot: ScenarioBackendReplaySnapshot = {
  id: "snapshot-target",
  organizationId: "org-story-drift-labs",
  scenarioId: targetScenario.id,
  scenarioVersionId: targetVersion.id,
  trigger: "playback",
  currentTime: 65,
  activeEventIds: ["evt-1", "evt-3"],
  nodeStates: {
    gateway: "healthy",
    api: "down",
    db: "degraded",
    queue: "degraded",
  },
  createdAt: "2026-04-23T09:18:00.000Z",
};

describe("scenario comparison", () => {
  it("summarizes revision-level topology, event, and narrative changes", () => {
    const comparison = compareScenarioVersions(baseVersion, targetVersion);

    expect(comparison.summary.metadataChanges).toBe(3);
    expect(comparison.summary.nodeAdded).toBe(1);
    expect(comparison.summary.nodeChanged).toBe(1);
    expect(comparison.summary.edgeAdded).toBe(1);
    expect(comparison.summary.eventAdded).toBe(1);
    expect(comparison.summary.eventRemoved).toBe(1);
    expect(comparison.summary.eventChanged).toBe(1);
    expect(comparison.summary.narrativeChanges).toBe(4);
    expect(
      comparison.nodeChanges.some(
        (change) =>
          change.id === "api" &&
          change.kind === "changed" &&
          change.changes.some((fieldChange) => fieldChange.field === "Status"),
      ),
    ).toBe(true);
  });

  it("compares replay snapshots for state transitions and active event deltas", () => {
    const comparison = compareReplaySnapshots({
      baseSnapshot,
      targetSnapshot,
      versionRecords: [baseVersion, targetVersion],
    });

    expect(comparison.summary.nodeStateChanges).toBe(3);
    expect(comparison.summary.eventsActivated).toBe(1);
    expect(comparison.summary.eventsResolved).toBe(1);
    expect(comparison.summary.timeDeltaSeconds).toBe(25);
    expect(comparison.summary.revisionChanged).toBe(true);
    expect(
      comparison.nodeStateChanges.some(
        (change) => change.nodeId === "api" && change.beforeStatus === "degraded" && change.afterStatus === "down",
      ),
    ).toBe(true);
    expect(comparison.activatedEvents[0]?.title).toBe("Queue backlog");
    expect(comparison.resolvedEvents[0]?.title).toBe("Database saturation");
  });
});
