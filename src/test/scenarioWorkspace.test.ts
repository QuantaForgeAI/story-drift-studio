import { describe, expect, it } from "vitest";
import type { Scenario } from "@/data/scenarios";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";
import {
  createEmptyScenarioWorkspaceState,
  deleteCustomScenarioFromWorkspace,
  getCurrentScenario,
  getPublishedScenarioVersion,
  publishScenarioRevisionInWorkspace,
  recordScenarioExported,
  selectScenarioInWorkspace,
  upsertCustomScenarioInWorkspace,
} from "@/lib/scenarioWorkspace";

const scenarioFixture: Scenario = {
  schemaVersion: SCENARIO_SCHEMA_VERSION,
  id: "workspace-fixture",
  name: "Workspace Fixture",
  subtitle: "Version history fixture",
  severity: "medium",
  duration: 90,
  nodes: [
    { id: "api", label: "API", type: "service", x: 100, y: 100, status: "healthy" },
    { id: "db", label: "DB", type: "database", x: 240, y: 180, status: "healthy" },
  ],
  edges: [{ from: "api", to: "db" }],
  events: [
    {
      id: "evt-1",
      timestamp: 10,
      type: "drift",
      severity: "medium",
      title: "Drift",
      description: "API latency drift",
      affectedNodes: ["api"],
    },
  ],
  narrative: {
    executiveSummary: "Summary",
    technicalSummary: "Technical summary",
    rootCause: "Root cause",
    actions: ["Action 1"],
    impactScore: 44,
  },
};

describe("scenario workspace", () => {
  it("stores draft edits in place and creates new versions for imported revisions", () => {
    const createdState = upsertCustomScenarioInWorkspace(
      createEmptyScenarioWorkspaceState(),
      scenarioFixture,
      "builder",
      { now: "2026-04-16T00:00:00.000Z" },
    );
    const createdEntry = createdState.customEntries[0];

    expect(createdEntry.versions).toHaveLength(1);
    expect(getCurrentScenario(createdEntry).name).toBe("Workspace Fixture");

    const editedState = upsertCustomScenarioInWorkspace(
      createdState,
      {
        ...scenarioFixture,
        nodes: scenarioFixture.nodes.map((node) =>
          node.id === "api" ? { ...node, x: 180 } : node,
        ),
      },
      "edit",
      {
        now: "2026-04-16T00:05:00.000Z",
        recordVersion: false,
      },
    );
    const editedEntry = editedState.customEntries[0];

    expect(editedEntry.versions).toHaveLength(1);
    expect(getCurrentScenario(editedEntry).nodes[0].x).toBe(180);

    const importedState = upsertCustomScenarioInWorkspace(
      editedState,
      {
        ...scenarioFixture,
        subtitle: "Imported revision",
      },
      "import",
      { now: "2026-04-16T00:10:00.000Z" },
    );
    const importedEntry = importedState.customEntries[0];

    expect(importedEntry.versions).toHaveLength(2);
    expect(importedEntry.versions[1].revision).toBe(2);
    expect(importedState.auditLog.at(-1)?.type).toBe("scenario.imported");
  });

  it("publishes a chosen revision and exposes the published version", () => {
    const versionedState = upsertCustomScenarioInWorkspace(
      upsertCustomScenarioInWorkspace(
        createEmptyScenarioWorkspaceState(),
        scenarioFixture,
        "builder",
        { now: "2026-04-16T00:00:00.000Z" },
      ),
      {
        ...scenarioFixture,
        subtitle: "Revision two",
      },
      "import",
      { now: "2026-04-16T00:10:00.000Z" },
    );

    const publishedState = publishScenarioRevisionInWorkspace(
      versionedState,
      scenarioFixture.id,
      1,
      { now: "2026-04-16T00:15:00.000Z" },
    );
    const publishedEntry = publishedState.customEntries[0];
    const publishedVersion = getPublishedScenarioVersion(publishedEntry);

    expect(publishedVersion?.revision).toBe(1);
    expect(publishedVersion?.scenario.subtitle).toBe("Version history fixture");
    expect(publishedState.auditLog.at(-1)?.type).toBe("scenario.published");
  });

  it("records selection, export, and deletion activity", () => {
    const createdState = upsertCustomScenarioInWorkspace(
      createEmptyScenarioWorkspaceState(),
      scenarioFixture,
      "builder",
      { now: "2026-04-16T00:00:00.000Z" },
    );

    const selectedState = selectScenarioInWorkspace(
      createdState,
      scenarioFixture.id,
      { now: "2026-04-16T00:01:00.000Z" },
    );
    const exportedState = recordScenarioExported(
      selectedState,
      scenarioFixture.id,
      scenarioFixture.name,
      { now: "2026-04-16T00:02:00.000Z" },
    );
    const deletedState = deleteCustomScenarioFromWorkspace(
      exportedState,
      scenarioFixture.id,
      { now: "2026-04-16T00:03:00.000Z" },
    );

    expect(deletedState.customEntries).toHaveLength(0);
    expect(deletedState.activeScenarioId).toBeNull();
    expect(deletedState.auditLog.map((event) => event.type)).toEqual([
      "scenario.created",
      "scenario.selected",
      "scenario.exported",
      "scenario.deleted",
    ]);
  });
});

