import type { Scenario } from "@/data/scenarios";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";
import {
  formatScenarioValidationError,
  parseScenario,
} from "@/lib/scenarioSchema";

/**
 * Export a scenario as a JSON file
 */
export const exportScenario = (scenario: Scenario) => {
  const exportedScenario = parseScenario({
    ...scenario,
    schemaVersion: SCENARIO_SCHEMA_VERSION,
  });
  const json = JSON.stringify(exportedScenario, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scenario-${scenario.id}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Import a scenario from a JSON file
 */
export const importScenario = (file: File): Promise<Scenario> => {
  return new Promise((resolve, reject) => {
    if (file.size > 1024 * 1024) {
      reject(new Error("Scenario file exceeds the 1 MB import limit."));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const scenario = parseScenario(JSON.parse(json));

        resolve({
          ...scenario,
          id: `imported-${Date.now()}`,
        });
      } catch (err) {
        reject(new Error(`Failed to import scenario: ${formatScenarioValidationError(err)}`));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    reader.readAsText(file);
  });
};

/**
 * Create a template scenario for users to start with
 */
export const getScenarioTemplate = (): Scenario => ({
  schemaVersion: SCENARIO_SCHEMA_VERSION,
  id: "template-basic",
  name: "Basic System Failure",
  subtitle: "A simple incident template showing API gateway failure cascade",
  severity: "high",
  duration: 120,
  nodes: [
    { id: "gateway", label: "API Gateway", type: "gateway", x: 400, y: 60, status: "healthy" },
    { id: "api", label: "Core API", type: "service", x: 400, y: 180, status: "healthy" },
    { id: "db", label: "Database", type: "database", x: 600, y: 180, status: "healthy" },
  ],
  edges: [
    { from: "gateway", to: "api", animated: true },
    { from: "api", to: "db", animated: true },
  ],
  events: [
    {
      id: "evt-1",
      timestamp: 10,
      type: "drift",
      severity: "medium",
      title: "Performance Drift Detected",
      description: "API response times increased by 300%",
      affectedNodes: ["api"],
    },
    {
      id: "evt-2",
      timestamp: 30,
      type: "failure",
      severity: "critical",
      title: "Database Connection Pool Exhausted",
      description: "Database ran out of available connections",
      affectedNodes: ["db"],
    },
    {
      id: "evt-3",
      timestamp: 60,
      type: "cascade",
      severity: "critical",
      title: "Cascading Failure to API",
      description: "API layer fails due to database unavailability",
      affectedNodes: ["api"],
    },
    {
      id: "evt-4",
      timestamp: 100,
      type: "recovery",
      severity: "info",
      title: "Database Recovery",
      description: "Database connection pool recovered",
      affectedNodes: ["db"],
    },
  ],
  narrative: {
    executiveSummary: "API service degraded due to database connection exhaustion, causing cascading failure across the system.",
    technicalSummary: "Connection pool exhaustion in the database layer led to timeouts in the API service, which cascaded to the gateway.",
    rootCause: "Insufficient database connection pool size for sustained load",
    actions: ["Increase connection pool size", "Implement circuit breaker pattern", "Add database monitoring alerts"],
    impactScore: 75,
  },
});
