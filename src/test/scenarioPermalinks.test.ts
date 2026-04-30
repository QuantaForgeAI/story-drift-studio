import { describe, expect, it } from "vitest";
import type { Scenario } from "@/data/scenarios";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";
import {
  buildScenarioPath,
  buildScenarioSharePath,
  decodeScenarioSnapshot,
  encodeScenarioSnapshot,
  parseScenarioPresentationState,
} from "@/lib/scenarioPermalinks";

const scenarioFixture: Scenario = {
  schemaVersion: SCENARIO_SCHEMA_VERSION,
  id: "shareable-scenario",
  name: "Shareable Scenario",
  subtitle: "Permalink fixture",
  severity: "low",
  duration: 60,
  nodes: [
    { id: "client", label: "Client", type: "client", x: 20, y: 20, status: "healthy" },
    { id: "api", label: "API", type: "service", x: 160, y: 120, status: "healthy" },
  ],
  edges: [{ from: "client", to: "api" }],
  events: [
    {
      id: "evt-1",
      timestamp: 5,
      type: "alert",
      severity: "low",
      title: "Latency spike",
      description: "Latency is rising",
      affectedNodes: ["api"],
    },
  ],
  narrative: {
    executiveSummary: "Summary",
    technicalSummary: "Technical summary",
    rootCause: "Root cause",
    actions: ["Action"],
    impactScore: 18,
  },
};

describe("scenario permalinks", () => {
  it("builds a canonical route path", () => {
    expect(buildScenarioPath("my scenario/id")).toBe("/scenarios/my%20scenario%2Fid");
  });

  it("encodes and decodes scenario snapshots losslessly", () => {
    const encoded = encodeScenarioSnapshot(scenarioFixture);
    const decoded = decodeScenarioSnapshot(encoded);

    expect(decoded).toEqual(scenarioFixture);
  });

  it("includes revision and snapshot details in share paths when requested", () => {
    const sharePath = buildScenarioSharePath(scenarioFixture, {
      revision: 3,
      includeSnapshot: true,
    });

    expect(sharePath).toContain("/scenarios/shareable-scenario?");
    expect(sharePath).toContain("revision=3");
    expect(sharePath).toContain("snapshot=");
  });

  it("supports presentation presets in share paths", () => {
    const sharePath = buildScenarioSharePath(scenarioFixture, {
      presentation: {
        presenterMode: true,
        currentTime: 25,
        focusPanel: "timeline",
        bookmarkId: "bookmark-evt-1",
      },
    });
    const searchParams = new URL(sharePath, "https://example.com").searchParams;
    const parsedPresentation = parseScenarioPresentationState(searchParams);

    expect(sharePath).toContain("present=1");
    expect(sharePath).toContain("t=25");
    expect(parsedPresentation).toEqual({
      presenterMode: true,
      currentTime: 25,
      focusPanel: "timeline",
      bookmarkId: "bookmark-evt-1",
    });
  });
});
