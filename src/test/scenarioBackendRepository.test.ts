import { describe, expect, it } from "vitest";
import { ScenarioAuthorizationError } from "@/lib/scenarioAuth";
import { scenarios as builtInScenarios, type Scenario } from "@/data/scenarios";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";
import {
  ScenarioConflictError,
  createMockScenarioBackendRepository,
} from "@/lib/scenarioBackendRepository";
import {
  PHASE2_WORKSPACE_STORAGE_KEY,
  SCENARIO_BACKEND_CONTROL_STORAGE_KEY,
  getScenarioBackendTenantStorageKey,
} from "@/lib/scenarioPersistenceKeys";
import {
  createEmptyScenarioWorkspaceState,
  upsertCustomScenarioInWorkspace,
} from "@/lib/scenarioWorkspace";

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

const customScenarioFixture: Scenario = {
  schemaVersion: SCENARIO_SCHEMA_VERSION,
  id: "custom-backend-fixture",
  name: "Custom Backend Fixture",
  subtitle: "Repository test fixture",
  severity: "high",
  duration: 120,
  nodes: [
    { id: "client", label: "Client", type: "client", x: 100, y: 50, status: "healthy" },
    { id: "api", label: "API", type: "service", x: 260, y: 160, status: "healthy" },
  ],
  edges: [{ from: "client", to: "api" }],
  events: [
    {
      id: "evt-1",
      timestamp: 15,
      type: "alert",
      severity: "medium",
      title: "API drift",
      description: "API latency is elevated",
      affectedNodes: ["api"],
    },
  ],
  narrative: {
    executiveSummary: "Summary",
    technicalSummary: "Technical summary",
    rootCause: "Root cause",
    actions: ["Action"],
    impactScore: 48,
  },
};

describe("scenario backend repository", () => {
  it("seeds builtins and persists versions, publishing, and replay snapshots", () => {
    const storage = createMemoryStorage();
    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);

    const initialWorkspace = repository.getWorkspace();
    expect(initialWorkspace.organization.slug).toBe("story-drift-labs");
    expect(initialWorkspace.entries.some((entry) => entry.origin === "builtin")).toBe(true);

    const savedWorkspace = repository.saveScenario(customScenarioFixture, "builder");
    expect(savedWorkspace.entries.some((entry) => entry.scenarioId === customScenarioFixture.id)).toBe(true);

    const importedWorkspace = repository.saveScenario(
      {
        ...customScenarioFixture,
        subtitle: "Imported revision",
      },
      "import",
    );
    const customEntry = importedWorkspace.entries.find(
      (entry) => entry.scenarioId === customScenarioFixture.id,
    );

    expect(customEntry?.versions).toHaveLength(2);

    const publishedWorkspace = repository.publishScenarioRevision(customScenarioFixture.id, 1);
    const publishedEntry = publishedWorkspace.entries.find(
      (entry) => entry.scenarioId === customScenarioFixture.id,
    );
    expect(publishedEntry?.publishedVersionId).toBeDefined();

    const replayWorkspace = repository.captureReplaySnapshot({
      scenarioId: customScenarioFixture.id,
      revision: 1,
      trigger: "share",
      currentTime: 45,
      activeEventIds: ["evt-1"],
      nodeStates: new Map([
        ["client", "healthy"],
        ["api", "degraded"],
      ]),
    });
    expect(
      replayWorkspace.replaySnapshots.some(
        (snapshot) =>
          snapshot.scenarioId === customScenarioFixture.id &&
          snapshot.trigger === "share",
      ),
    ).toBe(true);
  });

  it("migrates the previous workspace storage shape into the backend store", () => {
    const storage = createMemoryStorage();
    const phase2WorkspaceState = upsertCustomScenarioInWorkspace(
      createEmptyScenarioWorkspaceState(),
      customScenarioFixture,
      "builder",
      { now: "2026-04-16T00:00:00.000Z" },
    );
    storage.setItem(
      PHASE2_WORKSPACE_STORAGE_KEY,
      JSON.stringify(phase2WorkspaceState),
    );

    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);
    const workspace = repository.getWorkspace(customScenarioFixture.id);

    expect(workspace.activeScenarioId).toBe(customScenarioFixture.id);
    expect(
      workspace.entries.some((entry) => entry.scenarioId === customScenarioFixture.id),
    ).toBe(true);
    expect(storage.getItem(SCENARIO_BACKEND_CONTROL_STORAGE_KEY)).toBeTruthy();
    expect(
      storage.getItem(getScenarioBackendTenantStorageKey("org-story-drift-labs")),
    ).toBeTruthy();
    expect(storage.getItem(PHASE2_WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it("switches active user sessions and enforces role permissions", () => {
    const storage = createMemoryStorage();
    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);

    const editorWorkspace = repository.signInAsUser("user-story-drift-editor");
    expect(editorWorkspace.viewer.name).toBe("Platform Engineer");
    expect(editorWorkspace.membership.role).toBe("editor");
    expect(editorWorkspace.authSession.method).toBe("preview");

    repository.saveScenario(customScenarioFixture, "builder");

    repository.signInAsUser("user-story-drift-viewer");
    const viewerWorkspace = repository.getWorkspace();
    expect(viewerWorkspace.membership.role).toBe("viewer");

    expect(() =>
      repository.saveScenario(
        {
          ...customScenarioFixture,
          id: "viewer-created",
        },
        "builder",
      ),
    ).toThrow(ScenarioAuthorizationError);

    expect(() =>
      repository.publishScenarioRevision(customScenarioFixture.id, 1),
    ).toThrow(ScenarioAuthorizationError);
  });

  it("creates enterprise OIDC sessions and switches tenant context from the provider", () => {
    const storage = createMemoryStorage();
    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);

    const oidcWorkspace = repository.signInWithOidc(
      "oidc-northstar-retail",
      "user-story-drift-editor",
    );

    expect(oidcWorkspace.organization.id).toBe("org-northstar-retail");
    expect(oidcWorkspace.viewer.id).toBe("user-story-drift-editor");
    expect(oidcWorkspace.authSession.method).toBe("oidc");
    expect(oidcWorkspace.authSession.providerId).toBe("oidc-northstar-retail");
    expect(oidcWorkspace.authSession.claims.org_id).toBe("org-northstar-retail");
    expect(oidcWorkspace.authSession.claims.role).toBe("admin");
    expect(oidcWorkspace.activeSsoProvider?.name).toContain("Northstar");

    const previewWorkspace = repository.signInAsUser("user-story-drift-editor");
    expect(previewWorkspace.authSession.method).toBe("preview");
    expect(previewWorkspace.authSession.providerId).toBeNull();
  });

  it("captures backend telemetry for workspace and scenario operations", () => {
    const storage = createMemoryStorage();
    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);

    repository.signInWithOidc("oidc-story-drift-labs", "user-story-drift-owner");
    repository.saveScenario(customScenarioFixture, "builder");
    repository.captureReplaySnapshot({
      scenarioId: customScenarioFixture.id,
      trigger: "share",
      currentTime: 45,
      activeEventIds: ["evt-1"],
      nodeStates: new Map([
        ["client", "healthy"],
        ["api", "degraded"],
      ]),
    });

    const workspace = repository.getWorkspace();
    const telemetryNames = workspace.telemetrySamples.map((sample) => sample.name);

    expect(telemetryNames).toContain("auth.oidc_sign_in");
    expect(telemetryNames).toContain("scenario.save");
    expect(telemetryNames).toContain("replay.capture_snapshot");
    expect(
      workspace.telemetrySamples.some(
        (sample) =>
          sample.source === "mock-backend" &&
          sample.unit === "ms" &&
          sample.value >= 0,
      ),
    ).toBe(true);
  });

  it("stores OWASP ASVS-aligned verification runs with actionable findings", async () => {
    const storage = createMemoryStorage();
    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);

    const previewWorkspace = await repository.runSecurityVerification();
    const previewRun = previewWorkspace.securityVerifications[0];

    expect(previewRun?.framework).toBe("OWASP ASVS-aligned");
    expect(previewRun?.authMethod).toBe("preview");
    expect(
      previewRun?.findings.some(
        (finding) =>
          finding.controlId === "V8.1" && finding.status === "warn",
      ),
    ).toBe(true);
    expect(
      previewRun?.findings.some(
        (finding) =>
          finding.controlId === "V9.1" && finding.status === "warn",
      ),
    ).toBe(true);
    expect((await repository.runSecurityVerification()).securityVerifications).toHaveLength(2);

    repository.signInWithOidc("oidc-story-drift-labs", "user-story-drift-owner");
    const oidcWorkspace = await repository.runSecurityVerification();
    const oidcRun = oidcWorkspace.securityVerifications[0];
    const authFinding = oidcRun?.findings.find(
      (finding) => finding.controlId === "V2.2",
    );

    expect(oidcRun?.authMethod).toBe("oidc");
    expect(authFinding?.status).toBe("pass");
    expect(oidcWorkspace.securityVerifications.length).toBeGreaterThan(0);
  });

  it("isolates custom scenarios, audit state, and preferences per tenant workspace", () => {
    const storage = createMemoryStorage();
    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);

    repository.setMotionMode("full");
    repository.saveScenario(customScenarioFixture, "builder");
    const firstWorkspace = repository.getWorkspace();
    expect(firstWorkspace.preferences.motionMode).toBe("full");
    expect(
      firstWorkspace.entries.some(
        (entry) => entry.scenarioId === customScenarioFixture.id && entry.origin === "custom",
      ),
    ).toBe(true);

    const switchedWorkspace = repository.switchOrganization("org-northstar-retail");
    expect(switchedWorkspace.organization.id).toBe("org-northstar-retail");
    expect(switchedWorkspace.preferences.motionMode).toBe("system");
    expect(
      switchedWorkspace.entries.some(
        (entry) => entry.scenarioId === customScenarioFixture.id && entry.origin === "custom",
      ),
    ).toBe(false);

    repository.setMotionMode("reduced");
    repository.saveScenario(
      {
        ...customScenarioFixture,
        id: "northstar-custom-scenario",
        name: "Northstar Checkout Cascade",
      },
      "builder",
    );

    const northstarWorkspace = repository.getWorkspace();
    expect(northstarWorkspace.preferences.motionMode).toBe("reduced");
    expect(
      northstarWorkspace.entries.some(
        (entry) => entry.scenarioId === "northstar-custom-scenario" && entry.origin === "custom",
      ),
    ).toBe(true);
    expect(
      northstarWorkspace.entries.some(
        (entry) => entry.scenarioId === customScenarioFixture.id && entry.origin === "custom",
      ),
    ).toBe(false);

    const restoredWorkspace = repository.switchOrganization("org-story-drift-labs");
    expect(restoredWorkspace.organization.id).toBe("org-story-drift-labs");
    expect(restoredWorkspace.preferences.motionMode).toBe("full");
    expect(
      restoredWorkspace.entries.some(
        (entry) => entry.scenarioId === customScenarioFixture.id && entry.origin === "custom",
      ),
    ).toBe(true);
    expect(
      restoredWorkspace.entries.some(
        (entry) => entry.scenarioId === "northstar-custom-scenario" && entry.origin === "custom",
      ),
    ).toBe(false);
  });

  it("captures structured audit metadata for draft edits and playback sessions", () => {
    const storage = createMemoryStorage();
    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);

    repository.signInAsUser("user-story-drift-editor");
    repository.saveScenario(customScenarioFixture, "builder");

    repository.saveScenario(
      {
        ...customScenarioFixture,
        nodes: customScenarioFixture.nodes.map((node) =>
          node.id === "api" ? { ...node, x: 320 } : node,
        ),
      },
      "edit",
      { recordVersion: false },
    );

    const editedWorkspace = repository.saveScenario(
      {
        ...customScenarioFixture,
        nodes: customScenarioFixture.nodes.map((node) =>
          node.id === "api" ? { ...node, x: 360 } : node,
        ),
      },
      "edit",
      { recordVersion: false },
    );

    const draftEditEvents = editedWorkspace.auditLog.filter(
      (event) => event.type === "scenario.updated" && event.source === "edit",
    );

    expect(draftEditEvents).toHaveLength(1);
    expect(draftEditEvents[0]?.actorName).toBe("Platform Engineer");
    expect(draftEditEvents[0]?.actorRole).toBe("editor");
    expect(draftEditEvents[0]?.changeCount).toBe(2);

    const playbackWorkspace = repository.captureReplaySnapshot({
      scenarioId: customScenarioFixture.id,
      trigger: "playback",
      currentTime: 120,
      activeEventIds: ["evt-1"],
      nodeStates: new Map([
        ["client", "healthy"],
        ["api", "degraded"],
      ]),
    });

    const playbackEvent = playbackWorkspace.auditLog.at(-1);
    expect(playbackEvent?.type).toBe("replay.playback.completed");
    expect(playbackEvent?.trigger).toBe("playback");
    expect(playbackEvent?.currentTime).toBe(120);
    expect(playbackEvent?.activeEventCount).toBe(1);
    expect(playbackEvent?.scenarioName).toBe(customScenarioFixture.name);
  });

  it("detects stale draft saves when another editor changed the scenario in place", () => {
    const storage = createMemoryStorage();
    const repositoryA = createMockScenarioBackendRepository(builtInScenarios, storage);
    const repositoryB = createMockScenarioBackendRepository(builtInScenarios, storage);

    const initialWorkspace = repositoryA.saveScenario(customScenarioFixture, "builder");
    const initialEntry = initialWorkspace.entries.find(
      (entry) => entry.scenarioId === customScenarioFixture.id,
    );

    expect(initialEntry).toBeDefined();

    repositoryB.saveScenario(
      {
        ...customScenarioFixture,
        nodes: customScenarioFixture.nodes.map((node) =>
          node.id === "api" ? { ...node, x: 340 } : node,
        ),
      },
      "edit",
      {
        recordVersion: false,
        baseVersionId: initialEntry?.currentVersionId ?? null,
        baseUpdatedAt: initialEntry?.updatedAt ?? null,
      },
    );

    expect(() =>
      repositoryA.saveScenario(
        {
          ...customScenarioFixture,
          nodes: customScenarioFixture.nodes.map((node) =>
            node.id === "api" ? { ...node, x: 380 } : node,
          ),
        },
        "edit",
        {
          recordVersion: false,
          baseVersionId: initialEntry?.currentVersionId ?? null,
          baseUpdatedAt: initialEntry?.updatedAt ?? null,
        },
      ),
    ).toThrow(ScenarioConflictError);
  });
});
