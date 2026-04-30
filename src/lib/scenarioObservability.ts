import type {
  OrganizationMembershipRole,
  ScenarioBackendControlState,
  ScenarioBackendState,
  ScenarioBackendSystemLog,
  ScenarioBackendTelemetrySample,
  ScenarioTelemetryScope,
  ScenarioTelemetrySource,
  ScenarioTelemetryStatus,
  ScenarioTelemetryUnit,
  ScenarioBackendTenantState,
  ScenarioSystemLogCategory,
  ScenarioSystemLogLevel,
} from "@/lib/scenarioBackendModels";
import {
  createEmptyScenarioBackendTenantState,
  parseScenarioBackendControlState,
  parseScenarioBackendState,
  parseScenarioBackendSystemLogs,
  parseScenarioBackendTelemetrySamples,
  parseScenarioBackendTenantState,
} from "@/lib/scenarioBackendModels";
import {
  OBSERVABILITY_BUFFER_STORAGE_KEY,
  OBSERVABILITY_TELEMETRY_BUFFER_STORAGE_KEY,
  SCENARIO_BACKEND_STORAGE_KEY,
  OBSERVABILITY_UPDATED_EVENT,
  SCENARIO_BACKEND_CONTROL_STORAGE_KEY,
  getObservabilityBufferStorageKey,
  getObservabilityTelemetryBufferStorageKey,
  getScenarioBackendTenantStorageKey,
} from "@/lib/scenarioPersistenceKeys";

type SystemLogValue = string | number | boolean | null;

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface ReportSystemLogInput {
  level: ScenarioSystemLogLevel;
  category: ScenarioSystemLogCategory;
  event: string;
  message: string;
  scenarioId?: string | null;
  scenarioName?: string | null;
  route?: string | null;
  details?: Record<string, unknown>;
  error?: unknown;
  requestId?: string;
  now?: string;
}

interface RecordTelemetrySampleInput {
  source: ScenarioTelemetrySource;
  scope: ScenarioTelemetryScope;
  name: string;
  value: number;
  unit: ScenarioTelemetryUnit;
  status?: ScenarioTelemetryStatus;
  scenarioId?: string | null;
  scenarioName?: string | null;
  route?: string | null;
  details?: Record<string, unknown>;
  requestId?: string;
  now?: string;
  notify?: boolean;
}

const MAX_SYSTEM_LOGS = 250;
const MAX_TELEMETRY_SAMPLES = 400;

function resolveStorage(storage?: StorageLike) {
  if (storage) return storage;

  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("Local storage is unavailable in this environment.");
  }

  return window.localStorage;
}

function resolveNow(now?: string) {
  return now ?? new Date().toISOString();
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createRuntimeState(
  control: ScenarioBackendControlState,
  tenant?: ScenarioBackendTenantState,
): ScenarioBackendState {
  const activeTenant =
    tenant ?? createEmptyScenarioBackendTenantState(control.currentOrganizationId);

  return {
    schemaVersion: 1,
    currentOrganizationId: control.currentOrganizationId,
    currentUserId: control.currentUserId,
    users: control.users,
    organizations: control.organizations,
    memberships: control.memberships,
    ssoProviders: control.ssoProviders,
    authSession: control.authSession,
    scenarios: activeTenant.scenarios,
    scenarioVersions: activeTenant.scenarioVersions,
    replaySnapshots: activeTenant.replaySnapshots,
    auditEvents: activeTenant.auditEvents,
    systemLogs: activeTenant.systemLogs,
    telemetrySamples: activeTenant.telemetrySamples,
    securityVerifications: activeTenant.securityVerifications,
    preferences: activeTenant.preferences,
  };
}

function normalizeLogDetails(
  details?: Record<string, unknown>,
): Record<string, SystemLogValue> {
  if (!details) return {};

  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (
        value == null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return [key, value];
      }

      return [key, JSON.stringify(value)];
    }),
  );
}

function trimSystemLogs(logs: ScenarioBackendSystemLog[]) {
  return logs
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-MAX_SYSTEM_LOGS);
}

function trimTelemetrySamples(logs: ScenarioBackendTelemetrySample[]) {
  return logs
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-MAX_TELEMETRY_SAMPLES);
}

function resolveActorRole(
  state: ScenarioBackendState,
): OrganizationMembershipRole | null {
  return (
    state.memberships.find(
      (item) =>
        item.organizationId === state.currentOrganizationId &&
        item.userId === state.currentUserId,
    )?.role ?? null
  );
}

function createSystemLogEntry(
  state: ScenarioBackendState | null,
  input: ReportSystemLogInput,
): ScenarioBackendSystemLog {
  const actor =
    state?.users.find((item) => item.id === state.currentUserId) ?? null;
  const error = input.error instanceof Error ? input.error : null;

  return {
    id: createId("backend-system-log"),
    organizationId: state?.currentOrganizationId ?? null,
    actorUserId: state?.currentUserId ?? null,
    actorName: actor?.name ?? null,
    actorEmail: actor?.email ?? null,
    actorRole: state ? resolveActorRole(state) : null,
    level: input.level,
    category: input.category,
    event: input.event,
    message: input.message,
    createdAt: resolveNow(input.now),
    requestId: input.requestId ?? createId("req"),
    route:
      input.route ??
      (typeof window !== "undefined" ? window.location.pathname : null),
    scenarioId: input.scenarioId ?? null,
    scenarioName: input.scenarioName ?? null,
    details: normalizeLogDetails(input.details),
    errorName: error?.name ?? null,
    errorStack: error?.stack ?? null,
  };
}

function createTelemetrySampleEntry(
  state: ScenarioBackendState | null,
  input: RecordTelemetrySampleInput,
): ScenarioBackendTelemetrySample {
  const actor =
    state?.users.find((item) => item.id === state.currentUserId) ?? null;

  return {
    id: createId("backend-telemetry"),
    organizationId: state?.currentOrganizationId ?? null,
    actorUserId: state?.currentUserId ?? null,
    actorName: actor?.name ?? null,
    actorRole: state ? resolveActorRole(state) : null,
    source: input.source,
    scope: input.scope,
    name: input.name,
    value: input.value,
    unit: input.unit,
    status: input.status ?? "ok",
    createdAt: resolveNow(input.now),
    requestId: input.requestId ?? createId("req"),
    route:
      input.route ??
      (typeof window !== "undefined" ? window.location.pathname : null),
    scenarioId: input.scenarioId ?? null,
    scenarioName: input.scenarioName ?? null,
    details: normalizeLogDetails(input.details),
  };
}

function readBufferedSystemLogs(storage: StorageLike) {
  return readBufferedSystemLogsForKey(storage, OBSERVABILITY_BUFFER_STORAGE_KEY);
}

function readBufferedTelemetrySamples(storage: StorageLike) {
  return readBufferedTelemetrySamplesForKey(
    storage,
    OBSERVABILITY_TELEMETRY_BUFFER_STORAGE_KEY,
  );
}

function readBufferedSystemLogsForKey(storage: StorageLike, key: string) {
  const raw = storage.getItem(key);
  if (!raw) return [];

  try {
    return parseScenarioBackendSystemLogs(JSON.parse(raw));
  } catch {
    storage.removeItem(key);
    return [];
  }
}

function readBufferedTelemetrySamplesForKey(storage: StorageLike, key: string) {
  const raw = storage.getItem(key);
  if (!raw) return [];

  try {
    return parseScenarioBackendTelemetrySamples(JSON.parse(raw));
  } catch {
    storage.removeItem(key);
    return [];
  }
}

function writeBufferedSystemLogs(
  storage: StorageLike,
  logs: ScenarioBackendSystemLog[],
  organizationId?: string | null,
) {
  storage.setItem(
    getObservabilityBufferStorageKey(organizationId),
    JSON.stringify(logs),
  );
}

function writeBufferedTelemetrySamples(
  storage: StorageLike,
  samples: ScenarioBackendTelemetrySample[],
  organizationId?: string | null,
) {
  storage.setItem(
    getObservabilityTelemetryBufferStorageKey(organizationId),
    JSON.stringify(samples),
  );
}

function notifyObservabilityUpdated() {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(OBSERVABILITY_UPDATED_EVENT));
}

export function flushBufferedSystemLogsIntoState(
  state: ScenarioBackendState,
  storage?: StorageLike,
) {
  const safeStorage = resolveStorage(storage);
  const bufferedLogs = [
    ...readBufferedSystemLogs(safeStorage),
    ...readBufferedSystemLogsForKey(
      safeStorage,
      getObservabilityBufferStorageKey(state.currentOrganizationId),
    ),
  ];

  if (bufferedLogs.length === 0) {
    return state;
  }

  safeStorage.removeItem(OBSERVABILITY_BUFFER_STORAGE_KEY);
  safeStorage.removeItem(getObservabilityBufferStorageKey(state.currentOrganizationId));
  return {
    ...state,
    systemLogs: trimSystemLogs([...state.systemLogs, ...bufferedLogs]),
  };
}

export function flushBufferedTelemetrySamplesIntoState(
  state: ScenarioBackendState,
  storage?: StorageLike,
) {
  const safeStorage = resolveStorage(storage);
  const bufferedSamples = [
    ...readBufferedTelemetrySamples(safeStorage),
    ...readBufferedTelemetrySamplesForKey(
      safeStorage,
      getObservabilityTelemetryBufferStorageKey(state.currentOrganizationId),
    ),
  ];

  if (bufferedSamples.length === 0) {
    return state;
  }

  safeStorage.removeItem(OBSERVABILITY_TELEMETRY_BUFFER_STORAGE_KEY);
  safeStorage.removeItem(
    getObservabilityTelemetryBufferStorageKey(state.currentOrganizationId),
  );
  return {
    ...state,
    telemetrySamples: trimTelemetrySamples([
      ...state.telemetrySamples,
      ...bufferedSamples,
    ]),
  };
}

export function recordTelemetrySample(
  input: RecordTelemetrySampleInput,
  storage?: StorageLike,
) {
  const safeStorage = resolveStorage(storage);
  const rawControlState = safeStorage.getItem(SCENARIO_BACKEND_CONTROL_STORAGE_KEY);
  const rawLegacyState = safeStorage.getItem(SCENARIO_BACKEND_STORAGE_KEY);
  const shouldNotify = input.notify ?? true;

  const maybeNotify = () => {
    if (shouldNotify) {
      notifyObservabilityUpdated();
    }
  };

  if (!rawControlState && !rawLegacyState) {
    const nextBufferedSamples = trimTelemetrySamples([
      ...readBufferedTelemetrySamples(safeStorage),
      createTelemetrySampleEntry(null, input),
    ]);
    writeBufferedTelemetrySamples(safeStorage, nextBufferedSamples);
    maybeNotify();
    return nextBufferedSamples[nextBufferedSamples.length - 1] ?? null;
  }

  try {
    if (rawControlState) {
      const control = parseScenarioBackendControlState(JSON.parse(rawControlState));
      const tenantStorageKey = getScenarioBackendTenantStorageKey(
        control.currentOrganizationId,
      );
      const rawTenantState = safeStorage.getItem(tenantStorageKey);

      if (!rawTenantState) {
        const nextBufferedSamples = trimTelemetrySamples([
          ...readBufferedTelemetrySamplesForKey(
            safeStorage,
            getObservabilityTelemetryBufferStorageKey(
              control.currentOrganizationId,
            ),
          ),
          createTelemetrySampleEntry(createRuntimeState(control), input),
        ]);
        writeBufferedTelemetrySamples(
          safeStorage,
          nextBufferedSamples,
          control.currentOrganizationId,
        );
        maybeNotify();
        return nextBufferedSamples[nextBufferedSamples.length - 1] ?? null;
      }

      const tenant = parseScenarioBackendTenantState(JSON.parse(rawTenantState));
      const state = createRuntimeState(control, tenant);
      const entry = createTelemetrySampleEntry(state, input);
      const nextTenantState: ScenarioBackendTenantState = {
        ...tenant,
        telemetrySamples: trimTelemetrySamples([...tenant.telemetrySamples, entry]),
      };
      safeStorage.setItem(tenantStorageKey, JSON.stringify(nextTenantState));
      maybeNotify();
      return entry;
    }

    const state = parseScenarioBackendState(JSON.parse(rawLegacyState as string));
    const entry = createTelemetrySampleEntry(state, input);
    const nextState = {
      ...state,
      telemetrySamples: trimTelemetrySamples([...state.telemetrySamples, entry]),
    };
    safeStorage.setItem(SCENARIO_BACKEND_STORAGE_KEY, JSON.stringify(nextState));
    maybeNotify();
    return entry;
  } catch {
    let organizationId: string | null = null;

    try {
      if (rawControlState) {
        organizationId = parseScenarioBackendControlState(
          JSON.parse(rawControlState),
        ).currentOrganizationId;
      }
    } catch {
      organizationId = null;
    }

    const nextBufferedSamples = trimTelemetrySamples([
      ...(organizationId
        ? readBufferedTelemetrySamplesForKey(
            safeStorage,
            getObservabilityTelemetryBufferStorageKey(organizationId),
          )
        : readBufferedTelemetrySamples(safeStorage)),
      createTelemetrySampleEntry(null, input),
    ]);
    writeBufferedTelemetrySamples(
      safeStorage,
      nextBufferedSamples,
      organizationId,
    );
    maybeNotify();
    return nextBufferedSamples[nextBufferedSamples.length - 1] ?? null;
  }
}

export function recordSystemLog(
  input: ReportSystemLogInput,
  storage?: StorageLike,
) {
  const safeStorage = resolveStorage(storage);
  const rawControlState = safeStorage.getItem(SCENARIO_BACKEND_CONTROL_STORAGE_KEY);
  const rawLegacyState = safeStorage.getItem(SCENARIO_BACKEND_STORAGE_KEY);

  if (!rawControlState && !rawLegacyState) {
    const nextBufferedLogs = trimSystemLogs([
      ...readBufferedSystemLogs(safeStorage),
      createSystemLogEntry(null, input),
    ]);
    writeBufferedSystemLogs(safeStorage, nextBufferedLogs);
    notifyObservabilityUpdated();
    return nextBufferedLogs[nextBufferedLogs.length - 1] ?? null;
  }

  try {
    if (rawControlState) {
      const control = parseScenarioBackendControlState(JSON.parse(rawControlState));
      const tenantStorageKey = getScenarioBackendTenantStorageKey(
        control.currentOrganizationId,
      );
      const rawTenantState = safeStorage.getItem(tenantStorageKey);

      if (!rawTenantState) {
        const nextBufferedLogs = trimSystemLogs([
          ...readBufferedSystemLogsForKey(
            safeStorage,
            getObservabilityBufferStorageKey(control.currentOrganizationId),
          ),
          createSystemLogEntry(createRuntimeState(control), input),
        ]);
        writeBufferedSystemLogs(
          safeStorage,
          nextBufferedLogs,
          control.currentOrganizationId,
        );
        notifyObservabilityUpdated();
        return nextBufferedLogs[nextBufferedLogs.length - 1] ?? null;
      }

      const tenant = parseScenarioBackendTenantState(JSON.parse(rawTenantState));
      const state = createRuntimeState(control, tenant);
      const entry = createSystemLogEntry(state, input);
      const nextTenantState: ScenarioBackendTenantState = {
        ...tenant,
        systemLogs: trimSystemLogs([...tenant.systemLogs, entry]),
      };
      safeStorage.setItem(tenantStorageKey, JSON.stringify(nextTenantState));
      notifyObservabilityUpdated();
      return entry;
    }

    const state = parseScenarioBackendState(JSON.parse(rawLegacyState as string));
    const entry = createSystemLogEntry(state, input);
    const nextState = {
      ...state,
      systemLogs: trimSystemLogs([...state.systemLogs, entry]),
    };
    safeStorage.setItem(SCENARIO_BACKEND_STORAGE_KEY, JSON.stringify(nextState));
    notifyObservabilityUpdated();
    return entry;
  } catch {
    let organizationId: string | null = null;

    try {
      if (rawControlState) {
        organizationId = parseScenarioBackendControlState(
          JSON.parse(rawControlState),
        ).currentOrganizationId;
      }
    } catch {
      organizationId = null;
    }

    const nextBufferedLogs = trimSystemLogs([
      ...(organizationId
        ? readBufferedSystemLogsForKey(
            safeStorage,
            getObservabilityBufferStorageKey(organizationId),
          )
        : readBufferedSystemLogs(safeStorage)),
      createSystemLogEntry(null, input),
    ]);
    writeBufferedSystemLogs(safeStorage, nextBufferedLogs, organizationId);
    notifyObservabilityUpdated();
    return nextBufferedLogs[nextBufferedLogs.length - 1] ?? null;
  }
}

export function reportSystemError(
  input: Omit<ReportSystemLogInput, "level">,
  storage?: StorageLike,
) {
  return recordSystemLog(
    {
      ...input,
      level: "error",
    },
    storage,
  );
}
