export const SCENARIO_BACKEND_STORAGE_KEY = "story-drift-studio/mock-backend/v1";
export const SCENARIO_BACKEND_CONTROL_STORAGE_KEY =
  "story-drift-studio/mock-backend/control-plane/v1";
export const SCENARIO_BACKEND_TENANT_STORAGE_KEY_PREFIX =
  "story-drift-studio/mock-backend/tenant/";
export const PHASE2_WORKSPACE_STORAGE_KEY = "story-drift-studio/scenario-workspace/v2";
export const OBSERVABILITY_BUFFER_STORAGE_KEY = "story-drift-studio/observability-buffer/v1";
export const OBSERVABILITY_BUFFER_STORAGE_KEY_PREFIX =
  "story-drift-studio/observability-buffer/tenant/";
export const OBSERVABILITY_TELEMETRY_BUFFER_STORAGE_KEY =
  "story-drift-studio/observability-telemetry-buffer/v1";
export const OBSERVABILITY_TELEMETRY_BUFFER_STORAGE_KEY_PREFIX =
  "story-drift-studio/observability-telemetry-buffer/tenant/";
export const OBSERVABILITY_UPDATED_EVENT = "story-drift-studio/observability-updated";

export function getScenarioBackendTenantStorageKey(organizationId: string) {
  return `${SCENARIO_BACKEND_TENANT_STORAGE_KEY_PREFIX}${organizationId}/workspace/v1`;
}

export function getObservabilityBufferStorageKey(organizationId?: string | null) {
  if (!organizationId) {
    return OBSERVABILITY_BUFFER_STORAGE_KEY;
  }

  return `${OBSERVABILITY_BUFFER_STORAGE_KEY_PREFIX}${organizationId}/v1`;
}

export function getObservabilityTelemetryBufferStorageKey(
  organizationId?: string | null,
) {
  if (!organizationId) {
    return OBSERVABILITY_TELEMETRY_BUFFER_STORAGE_KEY;
  }

  return `${OBSERVABILITY_TELEMETRY_BUFFER_STORAGE_KEY_PREFIX}${organizationId}/v1`;
}

export function isScenarioBackendStorageKey(key: string | null) {
  if (key == null) return true;

  return (
    key === SCENARIO_BACKEND_STORAGE_KEY ||
    key === SCENARIO_BACKEND_CONTROL_STORAGE_KEY ||
    key === PHASE2_WORKSPACE_STORAGE_KEY ||
    key === OBSERVABILITY_BUFFER_STORAGE_KEY ||
    key === OBSERVABILITY_TELEMETRY_BUFFER_STORAGE_KEY ||
    key.startsWith(SCENARIO_BACKEND_TENANT_STORAGE_KEY_PREFIX) ||
    key.startsWith(OBSERVABILITY_BUFFER_STORAGE_KEY_PREFIX) ||
    key.startsWith(OBSERVABILITY_TELEMETRY_BUFFER_STORAGE_KEY_PREFIX)
  );
}
