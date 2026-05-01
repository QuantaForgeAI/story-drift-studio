import type { ScenarioBackendSystemLog } from "@/lib/scenarioBackendModels";

function isRecoveredShellBoundaryLog(log: ScenarioBackendSystemLog) {
  return (
    log.event === "react.error_boundary" &&
    log.category === "render" &&
    log.message === "Application shell failed"
  );
}

export function selectRecentObservabilityLogs(
  logs: ScenarioBackendSystemLog[],
  limit = 4,
) {
  return logs
    .filter((log) => !isRecoveredShellBoundaryLog(log))
    .slice(0, limit);
}
