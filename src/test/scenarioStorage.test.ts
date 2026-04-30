import { describe, expect, it } from "vitest";
import type { Scenario } from "@/data/scenarios";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";
import {
  clearStoredScenarioWorkspace,
  loadStoredActiveScenarioId,
  loadStoredCustomScenarios,
  saveStoredActiveScenarioId,
  saveStoredCustomScenarios,
} from "@/lib/scenarioStorage";

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
  id: "custom-1",
  name: "Custom Scenario",
  subtitle: "Storage fixture",
  severity: "low",
  duration: 45,
  nodes: [
    { id: "api", label: "API", type: "service", x: 10, y: 20, status: "healthy" },
  ],
  edges: [],
  events: [
    {
      id: "evt-1",
      timestamp: 5,
      type: "drift",
      severity: "low",
      title: "Drift",
      description: "Minor drift",
      affectedNodes: ["api"],
    },
  ],
  narrative: {
    executiveSummary: "Summary",
    technicalSummary: "Technical summary",
    rootCause: "Root cause",
    actions: ["Action"],
    impactScore: 20,
  },
};

describe("scenario storage", () => {
  it("round-trips custom scenarios and active scenario ids through storage", () => {
    const storage = createMemoryStorage();

    saveStoredCustomScenarios([customScenarioFixture], storage);
    saveStoredActiveScenarioId(customScenarioFixture.id, storage);

    expect(loadStoredCustomScenarios(storage)).toEqual([customScenarioFixture]);
    expect(loadStoredActiveScenarioId(storage)).toBe(customScenarioFixture.id);
  });

  it("clears stored workspace state", () => {
    const storage = createMemoryStorage();

    saveStoredCustomScenarios([customScenarioFixture], storage);
    saveStoredActiveScenarioId(customScenarioFixture.id, storage);
    clearStoredScenarioWorkspace(storage);

    expect(loadStoredCustomScenarios(storage)).toEqual([]);
    expect(loadStoredActiveScenarioId(storage)).toBeNull();
  });
});
