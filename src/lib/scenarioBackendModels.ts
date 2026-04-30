import { z } from "zod";
import type { Scenario, TopologyNode } from "@/data/scenarios";
import { topologyNodeStatusValues } from "@/data/scenarios";
import { motionModeValues, type MotionMode } from "@/lib/motionPreferences";
import { parseScenario } from "@/lib/scenarioSchema";
import type {
  ScenarioAuditEventType,
  ScenarioAuditTrigger,
  ScenarioVersionSource,
  ScenarioWorkspaceOrigin,
} from "@/lib/scenarioWorkspace";

export const SCENARIO_BACKEND_SCHEMA_VERSION = 1;
export const SCENARIO_BACKEND_CONTROL_SCHEMA_VERSION = 1;
export const SCENARIO_BACKEND_TENANT_SCHEMA_VERSION = 1;

export type ScenarioRecordStatus = "draft" | "published" | "archived";
export type OrganizationMembershipRole =
  | "owner"
  | "admin"
  | "editor"
  | "viewer";
export type ScenarioBackendStorageStrategy = "tenant-local-storage";
export type ScenarioBackendAuthMethod = "preview" | "oidc";
export type ScenarioOidcProviderStatus = "active" | "warning";
export type ScenarioTelemetrySource = "client" | "mock-backend";
export type ScenarioTelemetryScope =
  | "browser"
  | "navigation"
  | "render"
  | "simulation"
  | "storage"
  | "auth"
  | "scenario"
  | "workspace"
  | "security"
  | "replay";
export type ScenarioTelemetryUnit = "ms" | "count" | "bytes" | "ratio";
export type ScenarioTelemetryStatus = "ok" | "warn" | "error";
export type ReplaySnapshotTrigger =
  | "manual"
  | "playback"
  | "share"
  | "export";
export type ScenarioSystemLogLevel = "info" | "warn" | "error";
export type ScenarioSystemLogCategory =
  | "application"
  | "auth"
  | "navigation"
  | "storage"
  | "scenario"
  | "import"
  | "share"
  | "export"
  | "playback"
  | "render"
  | "observability";
export type ScenarioSecurityVerificationStatus = "pass" | "warn" | "fail";
export type ScenarioSecurityVerificationSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";
export type ScenarioSecurityVerificationFamily =
  | "V1 Architecture"
  | "V2 Authentication"
  | "V4 Access Control"
  | "V5 Validation"
  | "V7 Error Handling"
  | "V8 Data Protection"
  | "V9 Communication"
  | "V10 Malicious Input";

export interface ScenarioBackendUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioBackendOrganization {
  id: string;
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioBackendMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationMembershipRole;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioBackendRecord {
  id: string;
  organizationId: string;
  slug: string;
  origin: ScenarioWorkspaceOrigin;
  status: ScenarioRecordStatus;
  currentVersionId: string;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
}

export interface ScenarioBackendVersionRecord {
  id: string;
  scenarioId: string;
  revision: number;
  createdAt: string;
  createdByUserId: string;
  source: ScenarioVersionSource;
  scenario: Scenario;
}

export interface ScenarioBackendReplaySnapshot {
  id: string;
  organizationId: string;
  scenarioId: string;
  scenarioVersionId: string;
  trigger: ReplaySnapshotTrigger;
  currentTime: number;
  activeEventIds: string[];
  nodeStates: Record<string, TopologyNode["status"]>;
  createdAt: string;
}

export interface ScenarioBackendAuditEvent {
  id: string;
  organizationId: string;
  scenarioId: string;
  actorUserId: string | null;
  type: ScenarioAuditEventType;
  message: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: OrganizationMembershipRole | null;
  scenarioName: string | null;
  revision: number | null;
  source: ScenarioVersionSource | null;
  trigger: ScenarioAuditTrigger | null;
  currentTime: number | null;
  activeEventCount: number | null;
  changeCount: number | null;
}

export interface ScenarioBackendSystemLog {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: OrganizationMembershipRole | null;
  level: ScenarioSystemLogLevel;
  category: ScenarioSystemLogCategory;
  event: string;
  message: string;
  createdAt: string;
  requestId: string;
  route: string | null;
  scenarioId: string | null;
  scenarioName: string | null;
  details: Record<string, string | number | boolean | null>;
  errorName: string | null;
  errorStack: string | null;
}

export interface ScenarioBackendTelemetrySample {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorRole: OrganizationMembershipRole | null;
  source: ScenarioTelemetrySource;
  scope: ScenarioTelemetryScope;
  name: string;
  value: number;
  unit: ScenarioTelemetryUnit;
  status: ScenarioTelemetryStatus;
  createdAt: string;
  requestId: string;
  route: string | null;
  scenarioId: string | null;
  scenarioName: string | null;
  details: Record<string, string | number | boolean | null>;
}

export interface ScenarioBackendSecurityVerificationFinding {
  id: string;
  family: ScenarioSecurityVerificationFamily;
  controlId: string;
  title: string;
  status: ScenarioSecurityVerificationStatus;
  severity: ScenarioSecurityVerificationSeverity;
  summary: string;
  evidence: string;
  remediation: string;
}

export interface ScenarioBackendSecurityVerificationRun {
  id: string;
  organizationId: string;
  framework: "OWASP ASVS-aligned";
  createdAt: string;
  actorUserId: string | null;
  actorName: string | null;
  actorRole: OrganizationMembershipRole | null;
  authMethod: ScenarioBackendAuthMethod;
  overallStatus: ScenarioSecurityVerificationStatus;
  passCount: number;
  warnCount: number;
  failCount: number;
  findings: ScenarioBackendSecurityVerificationFinding[];
}

export interface ScenarioBackendPreferences {
  activeScenarioId: string | null;
  motionMode: MotionMode;
}

export interface ScenarioBackendOidcProvider {
  id: string;
  organizationId: string;
  name: string;
  status: ScenarioOidcProviderStatus;
  issuer: string;
  clientId: string;
  discoveryUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  redirectUri: string;
  domainHint: string | null;
  enforceSso: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioBackendAuthSession {
  id: string;
  organizationId: string;
  userId: string;
  method: ScenarioBackendAuthMethod;
  providerId: string | null;
  providerName: string | null;
  issuer: string | null;
  subject: string | null;
  audience: string | null;
  email: string;
  startedAt: string;
  lastAuthenticatedAt: string;
  expiresAt: string | null;
  claims: Record<string, string | number | boolean | null>;
}

export interface ScenarioBackendControlState {
  schemaVersion: number;
  storageStrategy: ScenarioBackendStorageStrategy;
  currentOrganizationId: string;
  currentUserId: string;
  users: ScenarioBackendUser[];
  organizations: ScenarioBackendOrganization[];
  memberships: ScenarioBackendMembership[];
  ssoProviders: ScenarioBackendOidcProvider[];
  authSession: ScenarioBackendAuthSession | null;
}

export interface ScenarioBackendTenantState {
  schemaVersion: number;
  storageStrategy: ScenarioBackendStorageStrategy;
  organizationId: string;
  scenarios: ScenarioBackendRecord[];
  scenarioVersions: ScenarioBackendVersionRecord[];
  replaySnapshots: ScenarioBackendReplaySnapshot[];
  auditEvents: ScenarioBackendAuditEvent[];
  systemLogs: ScenarioBackendSystemLog[];
  telemetrySamples: ScenarioBackendTelemetrySample[];
  securityVerifications: ScenarioBackendSecurityVerificationRun[];
  preferences: ScenarioBackendPreferences;
}

export interface ScenarioBackendState {
  schemaVersion: number;
  currentOrganizationId: string;
  currentUserId: string;
  users: ScenarioBackendUser[];
  organizations: ScenarioBackendOrganization[];
  memberships: ScenarioBackendMembership[];
  ssoProviders: ScenarioBackendOidcProvider[];
  authSession: ScenarioBackendAuthSession | null;
  scenarios: ScenarioBackendRecord[];
  scenarioVersions: ScenarioBackendVersionRecord[];
  replaySnapshots: ScenarioBackendReplaySnapshot[];
  auditEvents: ScenarioBackendAuditEvent[];
  systemLogs: ScenarioBackendSystemLog[];
  telemetrySamples: ScenarioBackendTelemetrySample[];
  securityVerifications: ScenarioBackendSecurityVerificationRun[];
  preferences: ScenarioBackendPreferences;
}

const backendUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const backendOrganizationSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const backendMembershipSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  role: z.enum(["owner", "admin", "editor", "viewer"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const backendScenarioRecordSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  slug: z.string().min(1),
  origin: z.enum(["builtin", "custom"]),
  status: z.enum(["draft", "published", "archived"]),
  currentVersionId: z.string().min(1),
  publishedVersionId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdByUserId: z.string().min(1),
  updatedByUserId: z.string().min(1),
});

const backendScenarioVersionSchema = z.object({
  id: z.string().min(1),
  scenarioId: z.string().min(1),
  revision: z.number().int().min(1),
  createdAt: z.string().datetime(),
  createdByUserId: z.string().min(1),
  source: z.enum(["builtin", "builder", "import", "edit"]),
  scenario: z.unknown().transform((value) => parseScenario(value)),
});

const backendReplaySnapshotSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  scenarioId: z.string().min(1),
  scenarioVersionId: z.string().min(1),
  trigger: z.enum(["manual", "playback", "share", "export"]),
  currentTime: z.number().finite().min(0),
  activeEventIds: z.array(z.string().min(1)),
  nodeStates: z.record(z.enum(topologyNodeStatusValues)),
  createdAt: z.string().datetime(),
});

const backendAuditEventSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  scenarioId: z.string().min(1),
  actorUserId: z.string().nullable(),
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
  message: z.string().min(1),
  createdAt: z.string().datetime(),
  actorName: z.string().nullable().optional().default(null),
  actorEmail: z.string().nullable().optional().default(null),
  actorRole: z.enum(["owner", "admin", "editor", "viewer"]).nullable().optional().default(null),
  scenarioName: z.string().nullable().optional().default(null),
  revision: z.number().int().min(1).nullable().optional().default(null),
  source: z.enum(["builtin", "builder", "import", "edit"]).nullable().optional().default(null),
  trigger: z.enum(["manual", "playback", "share", "export"]).nullable().optional().default(null),
  currentTime: z.number().finite().min(0).nullable().optional().default(null),
  activeEventCount: z.number().int().min(0).nullable().optional().default(null),
  changeCount: z.number().int().min(1).nullable().optional().default(null),
});

const backendSystemLogValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const backendSystemLogSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().nullable().optional().default(null),
  actorUserId: z.string().nullable().optional().default(null),
  actorName: z.string().nullable().optional().default(null),
  actorEmail: z.string().nullable().optional().default(null),
  actorRole: z.enum(["owner", "admin", "editor", "viewer"]).nullable().optional().default(null),
  level: z.enum(["info", "warn", "error"]),
  category: z.enum([
    "application",
    "auth",
    "navigation",
    "storage",
    "scenario",
    "import",
    "share",
    "export",
    "playback",
    "render",
    "observability",
  ]),
  event: z.string().min(1),
  message: z.string().min(1),
  createdAt: z.string().datetime(),
  requestId: z.string().min(1),
  route: z.string().nullable().optional().default(null),
  scenarioId: z.string().nullable().optional().default(null),
  scenarioName: z.string().nullable().optional().default(null),
  details: z.record(backendSystemLogValueSchema).optional().default({}),
  errorName: z.string().nullable().optional().default(null),
  errorStack: z.string().nullable().optional().default(null),
});

const backendTelemetrySampleSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().nullable().optional().default(null),
  actorUserId: z.string().nullable().optional().default(null),
  actorName: z.string().nullable().optional().default(null),
  actorRole: z.enum(["owner", "admin", "editor", "viewer"]).nullable().optional().default(null),
  source: z.enum(["client", "mock-backend"]),
  scope: z.enum([
    "browser",
    "navigation",
    "render",
    "simulation",
    "storage",
    "auth",
    "scenario",
    "workspace",
    "security",
    "replay",
  ]),
  name: z.string().min(1),
  value: z.number().finite(),
  unit: z.enum(["ms", "count", "bytes", "ratio"]),
  status: z.enum(["ok", "warn", "error"]).optional().default("ok"),
  createdAt: z.string().datetime(),
  requestId: z.string().min(1),
  route: z.string().nullable().optional().default(null),
  scenarioId: z.string().nullable().optional().default(null),
  scenarioName: z.string().nullable().optional().default(null),
  details: z.record(backendSystemLogValueSchema).optional().default({}),
});

const backendSecurityVerificationFindingSchema = z.object({
  id: z.string().min(1),
  family: z.enum([
    "V1 Architecture",
    "V2 Authentication",
    "V4 Access Control",
    "V5 Validation",
    "V7 Error Handling",
    "V8 Data Protection",
    "V9 Communication",
    "V10 Malicious Input",
  ]),
  controlId: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["pass", "warn", "fail"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string().min(1),
  evidence: z.string().min(1),
  remediation: z.string().min(1),
});

const backendSecurityVerificationRunSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  framework: z.literal("OWASP ASVS-aligned"),
  createdAt: z.string().datetime(),
  actorUserId: z.string().nullable().optional().default(null),
  actorName: z.string().nullable().optional().default(null),
  actorRole: z.enum(["owner", "admin", "editor", "viewer"]).nullable().optional().default(null),
  authMethod: z.enum(["preview", "oidc"]),
  overallStatus: z.enum(["pass", "warn", "fail"]),
  passCount: z.number().int().min(0),
  warnCount: z.number().int().min(0),
  failCount: z.number().int().min(0),
  findings: z.array(backendSecurityVerificationFindingSchema),
});

const backendPreferencesSchema = z.object({
  activeScenarioId: z.string().nullable(),
  motionMode: z.enum(motionModeValues).optional().default("system"),
});

const backendAuthClaimSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const backendOidcProviderSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["active", "warning"]),
  issuer: z.string().min(1),
  clientId: z.string().min(1),
  discoveryUrl: z.string().min(1),
  authorizationEndpoint: z.string().min(1),
  tokenEndpoint: z.string().min(1),
  scopes: z.array(z.string().min(1)).min(1),
  redirectUri: z.string().min(1),
  domainHint: z.string().nullable().optional().default(null),
  enforceSso: z.boolean().optional().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const backendAuthSessionSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  method: z.enum(["preview", "oidc"]),
  providerId: z.string().nullable().optional().default(null),
  providerName: z.string().nullable().optional().default(null),
  issuer: z.string().nullable().optional().default(null),
  subject: z.string().nullable().optional().default(null),
  audience: z.string().nullable().optional().default(null),
  email: z.string().email(),
  startedAt: z.string().datetime(),
  lastAuthenticatedAt: z.string().datetime(),
  expiresAt: z.string().nullable().optional().default(null),
  claims: z.record(backendAuthClaimSchema).optional().default({}),
});

const backendControlStateSchema = z.object({
  schemaVersion: z.literal(SCENARIO_BACKEND_CONTROL_SCHEMA_VERSION),
  storageStrategy: z.literal("tenant-local-storage"),
  currentOrganizationId: z.string().min(1),
  currentUserId: z.string().min(1),
  users: z.array(backendUserSchema).min(1),
  organizations: z.array(backendOrganizationSchema).min(1),
  memberships: z.array(backendMembershipSchema).min(1),
  ssoProviders: z.array(backendOidcProviderSchema).optional().default([]),
  authSession: backendAuthSessionSchema.nullable().optional().default(null),
});

const backendTenantStateSchema = z.object({
  schemaVersion: z.literal(SCENARIO_BACKEND_TENANT_SCHEMA_VERSION),
  storageStrategy: z.literal("tenant-local-storage"),
  organizationId: z.string().min(1),
  scenarios: z.array(backendScenarioRecordSchema),
  scenarioVersions: z.array(backendScenarioVersionSchema),
  replaySnapshots: z.array(backendReplaySnapshotSchema),
  auditEvents: z.array(backendAuditEventSchema),
  systemLogs: z.array(backendSystemLogSchema).optional().default([]),
  telemetrySamples: z.array(backendTelemetrySampleSchema).optional().default([]),
  securityVerifications: z.array(backendSecurityVerificationRunSchema).optional().default([]),
  preferences: backendPreferencesSchema,
});

const backendStateSchema = z.object({
  schemaVersion: z.literal(SCENARIO_BACKEND_SCHEMA_VERSION),
  currentOrganizationId: z.string().min(1),
  currentUserId: z.string().min(1),
  users: z.array(backendUserSchema).min(1),
  organizations: z.array(backendOrganizationSchema).min(1),
  memberships: z.array(backendMembershipSchema).min(1),
  ssoProviders: z.array(backendOidcProviderSchema).optional().default([]),
  authSession: backendAuthSessionSchema.nullable().optional().default(null),
  scenarios: z.array(backendScenarioRecordSchema),
  scenarioVersions: z.array(backendScenarioVersionSchema),
  replaySnapshots: z.array(backendReplaySnapshotSchema),
  auditEvents: z.array(backendAuditEventSchema),
  systemLogs: z.array(backendSystemLogSchema).optional().default([]),
  telemetrySamples: z.array(backendTelemetrySampleSchema).optional().default([]),
  securityVerifications: z.array(backendSecurityVerificationRunSchema).optional().default([]),
  preferences: backendPreferencesSchema,
});

export function parseScenarioBackendState(input: unknown): ScenarioBackendState {
  return backendStateSchema.parse(input);
}

export function parseScenarioBackendSystemLogs(
  input: unknown,
): ScenarioBackendSystemLog[] {
  return z.array(backendSystemLogSchema).parse(input);
}

export function parseScenarioBackendTelemetrySamples(
  input: unknown,
): ScenarioBackendTelemetrySample[] {
  return z.array(backendTelemetrySampleSchema).parse(input);
}

export function parseScenarioBackendControlState(
  input: unknown,
): ScenarioBackendControlState {
  return backendControlStateSchema.parse(input);
}

export function parseScenarioBackendTenantState(
  input: unknown,
): ScenarioBackendTenantState {
  return backendTenantStateSchema.parse(input);
}

export function createEmptyScenarioBackendControlState(
  seed: Pick<
    ScenarioBackendControlState,
    "currentOrganizationId" | "currentUserId" | "users" | "organizations" | "memberships"
  > & Partial<Pick<ScenarioBackendControlState, "ssoProviders" | "authSession">>,
): ScenarioBackendControlState {
  return {
    schemaVersion: SCENARIO_BACKEND_CONTROL_SCHEMA_VERSION,
    storageStrategy: "tenant-local-storage",
    currentOrganizationId: seed.currentOrganizationId,
    currentUserId: seed.currentUserId,
    users: seed.users,
    organizations: seed.organizations,
    memberships: seed.memberships,
    ssoProviders: seed.ssoProviders ?? [],
    authSession: seed.authSession ?? null,
  };
}

export function createEmptyScenarioBackendTenantState(
  organizationId: string,
): ScenarioBackendTenantState {
  return {
    schemaVersion: SCENARIO_BACKEND_TENANT_SCHEMA_VERSION,
    storageStrategy: "tenant-local-storage",
    organizationId,
    scenarios: [],
    scenarioVersions: [],
    replaySnapshots: [],
    auditEvents: [],
    systemLogs: [],
    telemetrySamples: [],
    securityVerifications: [],
    preferences: {
      activeScenarioId: null,
      motionMode: "system",
    },
  };
}

export function createEmptyScenarioBackendState(
  seed: Pick<
    ScenarioBackendState,
    "currentOrganizationId" | "currentUserId" | "users" | "organizations" | "memberships"
  >,
): ScenarioBackendState {
  return {
    schemaVersion: SCENARIO_BACKEND_SCHEMA_VERSION,
    currentOrganizationId: seed.currentOrganizationId,
    currentUserId: seed.currentUserId,
    users: seed.users,
    organizations: seed.organizations,
    memberships: seed.memberships,
    ssoProviders: [],
    authSession: null,
    scenarios: [],
    scenarioVersions: [],
    replaySnapshots: [],
    auditEvents: [],
    systemLogs: [],
    telemetrySamples: [],
    securityVerifications: [],
    preferences: {
      activeScenarioId: null,
      motionMode: "system",
    },
  };
}
