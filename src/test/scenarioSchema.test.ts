import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { scenarios as builtInScenarios } from "@/data/scenarios";
import {
  formatScenarioValidationError,
  parseScenarioCollection,
  parseScenario,
} from "@/lib/scenarioSchema";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";

const validLegacyScenario = {
  id: "legacy-scenario",
  name: "Legacy Scenario",
  subtitle: "No schemaVersion yet",
  severity: "medium",
  duration: 90,
  nodes: [
    { id: "client", label: "Client", type: "client", x: 10, y: 10, status: "healthy" },
    { id: "api", label: "API", type: "service", x: 120, y: 80, status: "healthy" },
  ],
  edges: [{ from: "client", to: "api" }],
  events: [
    {
      id: "evt-2",
      timestamp: 30,
      type: "failure",
      severity: "high",
      title: "Failure",
      description: "API failure",
      affectedNodes: ["api"],
    },
    {
      id: "evt-1",
      timestamp: 10,
      type: "alert",
      severity: "low",
      title: "Warning",
      description: "Early warning",
      affectedNodes: ["api"],
    },
  ],
  narrative: {
    executiveSummary: "Summary",
    technicalSummary: "Technical summary",
    rootCause: "Root cause",
    actions: ["Action"],
    impactScore: 55,
  },
};

describe("scenario schema", () => {
  it("migrates legacy scenarios to the current schema version and sorts events", () => {
    const parsed = parseScenario(validLegacyScenario);

    expect(parsed.schemaVersion).toBe(SCENARIO_SCHEMA_VERSION);
    expect(parsed.events.map((event) => event.id)).toEqual(["evt-1", "evt-2"]);
  });

  it("rejects invalid graph references with actionable messages", () => {
    expect(() =>
      parseScenario({
        ...validLegacyScenario,
        edges: [{ from: "client", to: "missing-node" }],
      }),
    ).toThrow(ZodError);

    try {
      parseScenario({
        ...validLegacyScenario,
        events: [
          {
            ...validLegacyScenario.events[0],
            affectedNodes: ["missing-node"],
          },
        ],
      });
    } catch (error) {
      expect(formatScenarioValidationError(error)).toContain('Unknown affected node "missing-node"');
    }
  });

  it("accepts the built-in scenario catalog", () => {
    const parsed = parseScenarioCollection(builtInScenarios);
    expect(parsed).toHaveLength(builtInScenarios.length);
  });
});
