import { scenarios, type Scenario } from "@/data/scenarios";
import { getTimelineSnapshot } from "@/lib/simulation-core";

export function cloneScenario(scenario: Scenario): Scenario {
  return JSON.parse(JSON.stringify(scenario)) as Scenario;
}

export function getScenarioFixture(id: Scenario["id"]) {
  const scenario = scenarios.find((entry) => entry.id === id);

  if (!scenario) {
    throw new Error(`Unknown story fixture scenario: ${id}`);
  }

  return cloneScenario(scenario);
}

export function getTimelineFixture(id: Scenario["id"], time: number) {
  const scenario = getScenarioFixture(id);

  return {
    scenario,
    snapshot: getTimelineSnapshot(scenario, time),
  };
}
