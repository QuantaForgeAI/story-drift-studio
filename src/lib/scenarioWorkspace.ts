import { z } from "zod";
import type { Scenario } from "@/data/scenarios";
import { parseScenario } from "@/lib/scenarioSchema";

export type ScenarioWorkspaceOrigin = "builtin" | "custom";
export type ScenarioVersionSource = "builtin" | "builder" | "import" | "edit";
export type ScenarioAuditTrigger = "manual" | "playback" | "share" | "export";
export type ScenarioAuditEventType =
  | "scenario.created"
  | "scenario.imported"
  | "scenario.updated"
  | "scenario.deleted"
  | "scenario.selected"
  | "scenario.published"
  | "scenario.exported"
  | "replay.snapshot.captured"
  | "replay.playback.completed";

export interface ScenarioVersionRecord {
  id: string;
  revision: number;
  createdAt: string;
  source: ScenarioVersionSource;
  scenario: Scenario;
}

export interface ScenarioWorkspaceEntry {
  id: string;
  scenarioId: string;
  origin: ScenarioWorkspaceOrigin;
  currentVersionId: string;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  versions: ScenarioVersionRecord[];
}

export interface ScenarioAuditEvent {
  id: string;
  type: ScenarioAuditEventType;
  scenarioId: string;
  createdAt: string;
  message: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  scenarioName: string | null;
  revision: number | null;
  source: ScenarioVersionSource | null;
  trigger: ScenarioAuditTrigger | null;
  currentTime: number | null;
  activeEventCount: number | null;
  changeCount: number | null;
}

export interface ScenarioWorkspaceState {
  customEntries: ScenarioWorkspaceEntry[];
  activeScenarioId: string | null;
  auditLog: ScenarioAuditEvent[];
}

const scenarioVersionRecordSchema = z.object({
  id: z.string().min(1),
  revision: z.number().int().min(1),
  createdAt: z.string().datetime(),
  source: z.enum(["builtin", "builder", "import", "edit"]),
  scenario: z.unknown().transform((value) => parseScenario(value)),
});

const scenarioWorkspaceEntrySchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  origin: z.enum(["builtin", "custom"]),
  currentVersionId: z.string().min(1),
  publishedVersionId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  versions: z.array(scenarioVersionRecordSchema).min(1),
});

const scenarioAuditEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "scenario.created",
    "scenario.imported",
    "scenario.updated",
    "scenario.deleted",
    "scenario.selected",
    "scenario.published",
    "scenario.exported",
    "replay.snapshot.captured",
    "replay.playback.completed",
  ]),
  scenarioId: z.string().min(1),
  createdAt: z.string().datetime(),
  message: z.string().min(1),
  actorUserId: z.string().nullable().optional().default(null),
  actorName: z.string().nullable().optional().default(null),
  actorEmail: z.string().nullable().optional().default(null),
  actorRole: z.string().nullable().optional().default(null),
  scenarioName: z.string().nullable().optional().default(null),
  revision: z.number().int().min(1).nullable().optional().default(null),
  source: z.enum(["builtin", "builder", "import", "edit"]).nullable().optional().default(null),
  trigger: z.enum(["manual", "playback", "share", "export"]).nullable().optional().default(null),
  currentTime: z.number().finite().min(0).nullable().optional().default(null),
  activeEventCount: z.number().int().min(0).nullable().optional().default(null),
  changeCount: z.number().int().min(1).nullable().optional().default(null),
});

const scenarioWorkspaceStateSchema = z.object({
  customEntries: z.array(scenarioWorkspaceEntrySchema),
  activeScenarioId: z.string().nullable(),
  auditLog: z.array(scenarioAuditEventSchema),
});

interface TimestampOptions {
  now?: string;
}

interface ScenarioAuditDetailsOptions extends TimestampOptions {
  actorUserId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  scenarioName?: string | null;
  revision?: number | null;
  source?: ScenarioVersionSource | null;
  trigger?: ScenarioAuditTrigger | null;
  currentTime?: number | null;
  activeEventCount?: number | null;
  changeCount?: number | null;
}

interface UpdateEntryOptions extends TimestampOptions {
  source?: ScenarioVersionSource;
  recordVersion?: boolean;
  recordAudit?: boolean;
}

interface SelectScenarioOptions extends TimestampOptions {
  recordAudit?: boolean;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function resolveNow(now?: string) {
  return now ?? new Date().toISOString();
}

function createScenarioVersionRecord(
  scenario: Scenario,
  revision: number,
  source: ScenarioVersionSource,
  now?: string,
): ScenarioVersionRecord {
  return {
    id: createId("scenario-version"),
    revision,
    createdAt: resolveNow(now),
    source,
    scenario: parseScenario(scenario),
  };
}

export function getCurrentScenarioVersion(entry: ScenarioWorkspaceEntry) {
  return (
    entry.versions.find((version) => version.id === entry.currentVersionId) ??
    entry.versions[entry.versions.length - 1]
  );
}

export function getCurrentScenario(entry: ScenarioWorkspaceEntry) {
  return getCurrentScenarioVersion(entry).scenario;
}

export function getScenarioVersionByRevision(
  entry: ScenarioWorkspaceEntry,
  revision: number,
) {
  return entry.versions.find((version) => version.revision === revision) ?? null;
}

export function getPublishedScenarioVersion(entry: ScenarioWorkspaceEntry) {
  if (!entry.publishedVersionId) return null;

  return (
    entry.versions.find((version) => version.id === entry.publishedVersionId) ??
    null
  );
}

export function createCustomScenarioEntry(
  scenario: Scenario,
  source: ScenarioVersionSource = "builder",
  options: TimestampOptions = {},
): ScenarioWorkspaceEntry {
  const now = resolveNow(options.now);
  const version = createScenarioVersionRecord(scenario, 1, source, now);

  return {
    id: createId("scenario-entry"),
    scenarioId: scenario.id,
    origin: "custom",
    currentVersionId: version.id,
    publishedVersionId: null,
    createdAt: now,
    updatedAt: now,
    versions: [version],
  };
}

export function createBuiltinScenarioEntries(
  scenarios: Scenario[],
  options: TimestampOptions = {},
): ScenarioWorkspaceEntry[] {
  const now = resolveNow(options.now);

  return scenarios.map((scenario) => {
    const version = createScenarioVersionRecord(scenario, 1, "builtin", now);

    return {
      id: `builtin-${scenario.id}`,
      scenarioId: scenario.id,
      origin: "builtin",
      currentVersionId: version.id,
      publishedVersionId: version.id,
      createdAt: now,
      updatedAt: now,
      versions: [version],
    };
  });
}

export function updateScenarioWorkspaceEntry(
  entry: ScenarioWorkspaceEntry,
  scenario: Scenario,
  options: UpdateEntryOptions = {},
): ScenarioWorkspaceEntry {
  const now = resolveNow(options.now);
  const source = options.source ?? "edit";
  const recordVersion = options.recordVersion ?? true;
  const normalizedScenario = parseScenario(scenario);

  if (!recordVersion) {
    return {
      ...entry,
      updatedAt: now,
      versions: entry.versions.map((version) =>
        version.id === entry.currentVersionId
          ? {
              ...version,
              source,
              scenario: normalizedScenario,
            }
          : version,
      ),
    };
  }

  const nextVersion = createScenarioVersionRecord(
    normalizedScenario,
    entry.versions.length + 1,
    source,
    now,
  );

  return {
    ...entry,
    currentVersionId: nextVersion.id,
    updatedAt: now,
    versions: [...entry.versions, nextVersion],
  };
}

export function createScenarioAuditEvent(
  type: ScenarioAuditEventType,
  scenarioId: string,
  message: string,
  options: ScenarioAuditDetailsOptions = {},
): ScenarioAuditEvent {
  return {
    id: createId("scenario-audit"),
    type,
    scenarioId,
    createdAt: resolveNow(options.now),
    message,
    actorUserId: options.actorUserId ?? null,
    actorName: options.actorName ?? null,
    actorEmail: options.actorEmail ?? null,
    actorRole: options.actorRole ?? null,
    scenarioName: options.scenarioName ?? null,
    revision: options.revision ?? null,
    source: options.source ?? null,
    trigger: options.trigger ?? null,
    currentTime: options.currentTime ?? null,
    activeEventCount: options.activeEventCount ?? null,
    changeCount: options.changeCount ?? null,
  };
}

function trimAuditLog(log: ScenarioAuditEvent[]) {
  return log.slice(-100);
}

export function selectScenarioInWorkspace(
  state: ScenarioWorkspaceState,
  scenarioId: string,
  options: SelectScenarioOptions = {},
): ScenarioWorkspaceState {
  const recordAudit = options.recordAudit ?? true;
  if (!recordAudit) {
    return { ...state, activeScenarioId: scenarioId };
  }

  return {
    ...state,
    activeScenarioId: scenarioId,
    auditLog: trimAuditLog([
      ...state.auditLog,
      createScenarioAuditEvent("scenario.selected", scenarioId, `Selected scenario ${scenarioId}`, options),
    ]),
  };
}

export function upsertCustomScenarioInWorkspace(
  state: ScenarioWorkspaceState,
  scenario: Scenario,
  source: ScenarioVersionSource,
  options: UpdateEntryOptions = {},
): ScenarioWorkspaceState {
  const recordAudit = options.recordAudit ?? true;
  const existingEntry = state.customEntries.find((entry) => entry.scenarioId === scenario.id);
  const nextEntry = existingEntry
    ? updateScenarioWorkspaceEntry(existingEntry, scenario, {
        ...options,
        source,
        recordVersion: source !== "edit",
      })
    : createCustomScenarioEntry(scenario, source, options);

  const nextEntries = existingEntry
    ? state.customEntries.map((entry) => (entry.scenarioId === scenario.id ? nextEntry : entry))
    : [...state.customEntries, nextEntry];

  const type = existingEntry
    ? source === "import"
      ? "scenario.imported"
      : "scenario.updated"
    : source === "import"
    ? "scenario.imported"
    : "scenario.created";

  const message = existingEntry
    ? `Updated scenario ${scenario.name}`
    : source === "import"
    ? `Imported scenario ${scenario.name}`
    : `Created scenario ${scenario.name}`;

  if (!recordAudit) {
    return {
      customEntries: nextEntries,
      activeScenarioId: scenario.id,
      auditLog: state.auditLog,
    };
  }

  return {
    customEntries: nextEntries,
    activeScenarioId: scenario.id,
    auditLog: trimAuditLog([
      ...state.auditLog,
      createScenarioAuditEvent(type, scenario.id, message, options),
    ]),
  };
}

export function deleteCustomScenarioFromWorkspace(
  state: ScenarioWorkspaceState,
  scenarioId: string,
  options: TimestampOptions = {},
): ScenarioWorkspaceState {
  return {
    customEntries: state.customEntries.filter((entry) => entry.scenarioId !== scenarioId),
    activeScenarioId: state.activeScenarioId === scenarioId ? null : state.activeScenarioId,
    auditLog: trimAuditLog([
      ...state.auditLog,
      createScenarioAuditEvent("scenario.deleted", scenarioId, `Deleted scenario ${scenarioId}`, options),
    ]),
  };
}

export function recordScenarioExported(
  state: ScenarioWorkspaceState,
  scenarioId: string,
  scenarioName: string,
  options: TimestampOptions = {},
): ScenarioWorkspaceState {
  return {
    ...state,
    auditLog: trimAuditLog([
      ...state.auditLog,
      createScenarioAuditEvent(
        "scenario.exported",
        scenarioId,
        `Exported scenario ${scenarioName}`,
        options,
      ),
    ]),
  };
}

export function publishScenarioRevisionInWorkspace(
  state: ScenarioWorkspaceState,
  scenarioId: string,
  revision: number,
  options: TimestampOptions = {},
): ScenarioWorkspaceState {
  let publishedScenarioName = scenarioId;
  const nextEntries = state.customEntries.map((entry) => {
    if (entry.scenarioId !== scenarioId) {
      return entry;
    }

    const version = getScenarioVersionByRevision(entry, revision);
    if (!version) {
      return entry;
    }

    publishedScenarioName = version.scenario.name;

    return {
      ...entry,
      publishedVersionId: version.id,
      updatedAt: resolveNow(options.now),
    };
  });

  return {
    ...state,
    customEntries: nextEntries,
    auditLog: trimAuditLog([
      ...state.auditLog,
      createScenarioAuditEvent(
        "scenario.published",
        scenarioId,
        `Published revision ${revision} of ${publishedScenarioName}`,
        options,
      ),
    ]),
  };
}

export function createEmptyScenarioWorkspaceState(): ScenarioWorkspaceState {
  return {
    customEntries: [],
    activeScenarioId: null,
    auditLog: [],
  };
}

export function parseScenarioWorkspaceState(input: unknown): ScenarioWorkspaceState {
  const parsed = scenarioWorkspaceStateSchema.parse(input);
  return {
    customEntries: parsed.customEntries,
    activeScenarioId: parsed.activeScenarioId,
    auditLog: parsed.auditLog,
  };
}
