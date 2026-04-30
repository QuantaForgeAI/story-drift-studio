import React from "react";
import type { Scenario } from "@/data/scenarios";
import type { ScenarioWorkspacePermission } from "@/lib/scenarioAuth";
import {
  createMockScenarioBackendRepository,
  type ScenarioBackendReplaySnapshot,
  type ScenarioBackendWorkspace,
} from "@/lib/scenarioBackendRepository";
import type { MotionMode } from "@/lib/motionPreferences";
import {
  OBSERVABILITY_UPDATED_EVENT,
  isScenarioBackendStorageKey,
} from "@/lib/scenarioPersistenceKeys";
import {
  getCurrentScenario,
  getPublishedScenarioVersion,
  type ScenarioWorkspaceEntry,
} from "@/lib/scenarioWorkspace";

interface Options {
  builtInScenarios: Scenario[];
  preferredActiveScenarioId?: string | null;
}

interface ScenarioWorkspaceMetadata {
  origin: ScenarioWorkspaceEntry["origin"];
  versionCount: number;
  currentRevision: number;
  publishedRevision: number | null;
  published: boolean;
  snapshotCount: number;
  latestSnapshotAt: string | null;
}

export function useScenarioWorkspace({
  builtInScenarios,
  preferredActiveScenarioId,
}: Options) {
  const repository = React.useMemo(
    () => createMockScenarioBackendRepository(builtInScenarios),
    [builtInScenarios],
  );
  const [workspace, setWorkspace] = React.useState<ScenarioBackendWorkspace>(() =>
    repository.getWorkspace(preferredActiveScenarioId),
  );

  React.useEffect(() => {
    setWorkspace(repository.getWorkspace(preferredActiveScenarioId));
  }, [repository, preferredActiveScenarioId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key != null &&
        !isScenarioBackendStorageKey(event.key)
      ) {
        return;
      }

      setWorkspace(repository.getWorkspace(preferredActiveScenarioId));
    };

    window.addEventListener("storage", handleStorage);
    const handleObservabilityRefresh = () => {
      setWorkspace(repository.getWorkspace(preferredActiveScenarioId));
    };

    window.addEventListener(OBSERVABILITY_UPDATED_EVENT, handleObservabilityRefresh);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        OBSERVABILITY_UPDATED_EVENT,
        handleObservabilityRefresh,
      );
    };
  }, [repository, preferredActiveScenarioId]);

  const scenarioEntries = workspace.entries;
  const permissions = React.useMemo(
    () => new Set(workspace.permissions),
    [workspace.permissions],
  );
  const scenarioById = React.useMemo(
    () =>
      new Map(
        scenarioEntries.map((entry) => [entry.scenarioId, getCurrentScenario(entry)]),
      ),
    [scenarioEntries],
  );

  const activeScenarioId =
    (preferredActiveScenarioId &&
      scenarioById.has(preferredActiveScenarioId) &&
      preferredActiveScenarioId) ||
    workspace.activeScenarioId;
  const activeEntry =
    scenarioEntries.find((entry) => entry.scenarioId === activeScenarioId) ?? null;
  const activeScenario = activeScenarioId
    ? scenarioById.get(activeScenarioId) ?? null
    : null;

  const applyWorkspaceUpdate = React.useCallback(
    (nextWorkspace: ScenarioBackendWorkspace) => {
      setWorkspace(nextWorkspace);
      return nextWorkspace;
    },
    [],
  );

  const setActiveScenarioId = React.useCallback(
    (scenarioId: string, options?: { recordAudit?: boolean }) =>
      applyWorkspaceUpdate(repository.selectScenario(scenarioId, options)),
    [applyWorkspaceUpdate, repository],
  );

  const signInAsUser = React.useCallback(
    (userId: string) => applyWorkspaceUpdate(repository.signInAsUser(userId)),
    [applyWorkspaceUpdate, repository],
  );

  const signInWithOidc = React.useCallback(
    (providerId: string, userId: string) =>
      applyWorkspaceUpdate(repository.signInWithOidc(providerId, userId)),
    [applyWorkspaceUpdate, repository],
  );

  const switchOrganization = React.useCallback(
    (organizationId: string) =>
      applyWorkspaceUpdate(repository.switchOrganization(organizationId)),
    [applyWorkspaceUpdate, repository],
  );

  const setMotionMode = React.useCallback(
    (motionMode: MotionMode) =>
      applyWorkspaceUpdate(repository.setMotionMode(motionMode)),
    [applyWorkspaceUpdate, repository],
  );

  const runSecurityVerification = React.useCallback(
    async () => applyWorkspaceUpdate(await repository.runSecurityVerification()),
    [applyWorkspaceUpdate, repository],
  );

  const saveScenario = React.useCallback(
    (
      scenario: Scenario,
      source: "builder" | "import" | "edit",
      options?: {
        recordVersion?: boolean;
        recordAudit?: boolean;
        baseVersionId?: string | null;
        baseUpdatedAt?: string | null;
      },
    ) =>
      applyWorkspaceUpdate(repository.saveScenario(scenario, source, options)),
    [applyWorkspaceUpdate, repository],
  );

  const updateScenarioDraft = React.useCallback(
    (scenarioId: string, updater: (scenario: Scenario) => Scenario) => {
      const currentScenario = scenarioById.get(scenarioId);
      const entry = scenarioEntries.find((item) => item.scenarioId === scenarioId);
      if (!currentScenario || !entry || entry.origin !== "custom") return workspace;

      return saveScenario(updater(currentScenario), "edit", {
        recordVersion: false,
        recordAudit: true,
        baseVersionId: entry.currentVersionId,
        baseUpdatedAt: entry.updatedAt,
      });
    },
    [saveScenario, scenarioById, scenarioEntries, workspace],
  );

  const refreshWorkspace = React.useCallback(
    () => applyWorkspaceUpdate(repository.getWorkspace(preferredActiveScenarioId)),
    [applyWorkspaceUpdate, preferredActiveScenarioId, repository],
  );

  const deleteScenario = React.useCallback(
    (scenarioId: string) =>
      applyWorkspaceUpdate(repository.deleteScenario(scenarioId)),
    [applyWorkspaceUpdate, repository],
  );

  const markScenarioExported = React.useCallback(
    (scenarioId: string, scenarioName: string, revision?: number | null) =>
      applyWorkspaceUpdate(
        repository.markScenarioExported(scenarioId, scenarioName, revision),
      ),
    [applyWorkspaceUpdate, repository],
  );

  const publishScenarioRevision = React.useCallback(
    (scenarioId: string, revision: number) =>
      applyWorkspaceUpdate(repository.publishScenarioRevision(scenarioId, revision)),
    [applyWorkspaceUpdate, repository],
  );

  const captureReplaySnapshot = React.useCallback(
    (input: {
      scenarioId: string;
      currentTime: number;
      activeEventIds: string[];
      nodeStates: Map<string, Scenario["nodes"][number]["status"]>;
      trigger: "manual" | "playback" | "share" | "export";
      revision?: number | null;
    }) => applyWorkspaceUpdate(repository.captureReplaySnapshot(input)),
    [applyWorkspaceUpdate, repository],
  );

  const metadataByScenarioId = React.useMemo(() => {
    const metadata = new Map<string, ScenarioWorkspaceMetadata>();

    for (const entry of scenarioEntries) {
      const currentVersion =
        entry.versions.find((version) => version.id === entry.currentVersionId) ??
        entry.versions[entry.versions.length - 1];
      const publishedVersion = getPublishedScenarioVersion(entry);
      const scenarioSnapshots = workspace.replaySnapshots.filter(
        (snapshot) => snapshot.scenarioId === entry.scenarioId,
      );

      metadata.set(entry.scenarioId, {
        origin: entry.origin,
        versionCount: entry.versions.length,
        currentRevision: currentVersion.revision,
        publishedRevision: publishedVersion?.revision ?? null,
        published: publishedVersion != null,
        snapshotCount: scenarioSnapshots.length,
        latestSnapshotAt: scenarioSnapshots[0]?.createdAt ?? null,
      });
    }

    return metadata;
  }, [scenarioEntries, workspace.replaySnapshots]);

  const snapshotsByScenarioId = React.useMemo(() => {
    const grouped = new Map<string, ScenarioBackendReplaySnapshot[]>();

    for (const snapshot of workspace.replaySnapshots) {
      const list = grouped.get(snapshot.scenarioId) ?? [];
      list.push(snapshot);
      grouped.set(snapshot.scenarioId, list);
    }

    return grouped;
  }, [workspace.replaySnapshots]);

  return {
    activeEntry,
    activeSsoProvider: workspace.activeSsoProvider,
    activeScenario,
    activeScenarioId,
    authSession: workspace.authSession,
    availableOrganizations: workspace.availableOrganizations,
    availableAccessProfiles: workspace.availableAccessProfiles,
    auditLog: workspace.auditLog,
    captureReplaySnapshot,
    customEntries: scenarioEntries.filter((entry) => entry.origin === "custom"),
    deleteScenario,
    hasPermission: (permission: ScenarioWorkspacePermission) =>
      permissions.has(permission),
    initialLoadError: workspace.initialLoadError,
    lastSyncedAt: workspace.lastSyncedAt,
    markScenarioExported,
    membership: workspace.membership,
    metadataByScenarioId,
    motionMode: workspace.preferences.motionMode,
    organization: workspace.organization,
    permissions: workspace.permissions,
    publishScenarioRevision,
    refreshWorkspace,
    replaySnapshots: workspace.replaySnapshots,
    runSecurityVerification,
    saveScenario,
    scenarioEntries,
    scenarios: scenarioEntries.map((entry) => getCurrentScenario(entry)),
    securityVerifications: workspace.securityVerifications,
    ssoConnections: workspace.ssoConnections,
    storageStrategy: workspace.storageStrategy,
    systemLogs: workspace.systemLogs,
    telemetrySamples: workspace.telemetrySamples,
    setActiveScenarioId,
    signInAsUser,
    signInWithOidc,
    snapshotsByScenarioId,
    switchOrganization,
    setMotionMode,
    updateScenarioDraft,
    viewer: workspace.viewer,
  };
}
