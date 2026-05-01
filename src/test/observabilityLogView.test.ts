import { describe, expect, it } from "vitest";
import type { ScenarioBackendSystemLog } from "@/lib/scenarioBackendModels";
import { selectRecentObservabilityLogs } from "@/lib/observabilityLogView";

function makeLog(
  overrides: Partial<ScenarioBackendSystemLog>,
): ScenarioBackendSystemLog {
  return {
    id: overrides.id ?? "log-1",
    organizationId: overrides.organizationId ?? "org-1",
    actorUserId: overrides.actorUserId ?? "user-1",
    actorName: overrides.actorName ?? "Scenario Architect",
    actorEmail: overrides.actorEmail ?? "architect@storydrift.local",
    actorRole: overrides.actorRole ?? "owner",
    level: overrides.level ?? "info",
    category: overrides.category ?? "runtime",
    event: overrides.event ?? "app.ready",
    message: overrides.message ?? "App ready",
    createdAt: overrides.createdAt ?? "2026-05-01T00:00:00.000Z",
    requestId: overrides.requestId ?? "req-1",
    route: overrides.route ?? "/",
    scenarioId: overrides.scenarioId ?? "scenario-1",
    scenarioName: overrides.scenarioName ?? "Supply Chain Compromise",
    details: overrides.details ?? {},
    errorName: overrides.errorName ?? null,
    errorStack: overrides.errorStack ?? null,
  };
}

describe("selectRecentObservabilityLogs", () => {
  it("filters recovered application shell boundary failures from the inline recent-log view", () => {
    const logs = [
      makeLog({
        id: "shell-failure",
        level: "error",
        category: "render",
        event: "react.error_boundary",
        message: "Application shell failed",
      }),
      makeLog({
        id: "topology-failure",
        level: "error",
        category: "render",
        event: "react.error_boundary",
        message: "Topology renderer failed",
      }),
    ];

    expect(selectRecentObservabilityLogs(logs)).toEqual([logs[1]]);
  });

  it("keeps non-shell render failures and respects the recent-log limit", () => {
    const logs = [
      makeLog({ id: "1", message: "Topology renderer failed", category: "render", event: "react.error_boundary" }),
      makeLog({ id: "2", message: "Timeline panel failed", category: "render", event: "react.error_boundary" }),
      makeLog({ id: "3", message: "Scenario exported", category: "export", event: "scenario.exported" }),
      makeLog({ id: "4", message: "Shared scenario link is invalid", category: "share", event: "share.snapshot_invalid", level: "warn" }),
      makeLog({ id: "5", message: "Workspace switched", category: "auth", event: "workspace.switched" }),
    ];

    expect(selectRecentObservabilityLogs(logs, 3).map((log) => log.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });
});
