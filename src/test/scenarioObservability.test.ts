import { describe, expect, it } from "vitest";
import { scenarios as builtInScenarios } from "@/data/scenarios";
import { createMockScenarioBackendRepository } from "@/lib/scenarioBackendRepository";
import {
  recordSystemLog,
  recordTelemetrySample,
  reportSystemError,
} from "@/lib/scenarioObservability";

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

describe("scenario observability", () => {
  it("buffers logs before the backend store exists and flushes them into the workspace", () => {
    const storage = createMemoryStorage();

    recordSystemLog(
      {
        level: "warn",
        category: "navigation",
        event: "route.not_found",
        message: "User attempted to access a missing route.",
        route: "/missing",
        details: {
          pathname: "/missing",
        },
      },
      storage,
    );

    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);
    const workspace = repository.getWorkspace();

    expect(workspace.systemLogs[0]?.event).toBe("route.not_found");
    expect(workspace.systemLogs[0]?.level).toBe("warn");
    expect(workspace.systemLogs[0]?.route).toBe("/missing");
  });

  it("stores structured error reports with actor context once the backend is available", () => {
    const storage = createMemoryStorage();
    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);

    repository.getWorkspace();
    reportSystemError(
      {
        category: "export",
        event: "scenario.export_failed",
        message: "Exporting a scenario failed.",
        scenarioId: "runtime-breakdown",
        scenarioName: "Runtime Breakdown",
        details: {
          revision: 2,
        },
        error: new Error("Disk quota exceeded"),
      },
      storage,
    );

    const workspace = repository.getWorkspace();
    const latestLog = workspace.systemLogs[0];

    expect(latestLog?.level).toBe("error");
    expect(latestLog?.actorName).toBe("Scenario Architect");
    expect(latestLog?.category).toBe("export");
    expect(latestLog?.event).toBe("scenario.export_failed");
    expect(latestLog?.scenarioName).toBe("Runtime Breakdown");
    expect(latestLog?.details.revision).toBe(2);
    expect(latestLog?.errorName).toBe("Error");
    expect(latestLog?.errorStack).toContain("Disk quota exceeded");
  });

  it("buffers telemetry before the backend store exists and flushes it into the workspace", () => {
    const storage = createMemoryStorage();

    recordTelemetrySample(
      {
        source: "client",
        scope: "browser",
        name: "browser.hardware_concurrency",
        value: 8,
        unit: "count",
        details: {
          viewportWidth: 1440,
        },
      },
      storage,
    );

    const repository = createMockScenarioBackendRepository(builtInScenarios, storage);
    const workspace = repository.getWorkspace();

    expect(workspace.telemetrySamples[0]?.name).toBe("browser.hardware_concurrency");
    expect(workspace.telemetrySamples[0]?.source).toBe("client");
    expect(workspace.telemetrySamples[0]?.value).toBe(8);
  });
});
