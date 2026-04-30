import type { Scenario, TopologyNode } from "@/data/scenarios";
import {
  assertScenarioPermission,
  getPermissionsForRole,
  type ScenarioWorkspacePermission,
} from "@/lib/scenarioAuth";
import {
  createEmptyScenarioBackendControlState,
  createEmptyScenarioBackendTenantState,
  parseScenarioBackendState,
  parseScenarioBackendControlState,
  parseScenarioBackendTenantState,
  type ScenarioBackendAuthMethod,
  type ScenarioBackendAuthSession,
  type ReplaySnapshotTrigger,
  type ScenarioBackendAuditEvent,
  type ScenarioBackendControlState,
  type ScenarioBackendMembership,
  type ScenarioBackendOidcProvider,
  type ScenarioBackendOrganization,
  type ScenarioBackendRecord,
  type ScenarioBackendReplaySnapshot,
  type ScenarioBackendSecurityVerificationRun,
  type ScenarioBackendState,
  type ScenarioBackendSystemLog,
  type ScenarioBackendTenantState,
  type ScenarioBackendUser,
  type ScenarioBackendVersionRecord,
} from "@/lib/scenarioBackendModels";
import { loadStoredActiveScenarioId, loadStoredCustomScenarios } from "@/lib/scenarioStorage";
import {
  parseScenarioWorkspaceState,
  type ScenarioAuditEvent,
  type ScenarioVersionRecord,
  type ScenarioVersionSource,
  type ScenarioWorkspaceEntry,
} from "@/lib/scenarioWorkspace";
import {
  PHASE2_WORKSPACE_STORAGE_KEY,
  SCENARIO_BACKEND_CONTROL_STORAGE_KEY,
  SCENARIO_BACKEND_STORAGE_KEY,
  getScenarioBackendTenantStorageKey,
} from "@/lib/scenarioPersistenceKeys";
import {
  flushBufferedSystemLogsIntoState,
  flushBufferedTelemetrySamplesIntoState,
  recordTelemetrySample,
} from "@/lib/scenarioObservability";
import type { MotionMode } from "@/lib/motionPreferences";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SaveScenarioOptions {
  recordVersion?: boolean;
  recordAudit?: boolean;
  baseVersionId?: string | null;
  baseUpdatedAt?: string | null;
}

interface CaptureReplaySnapshotInput {
  scenarioId: string;
  currentTime: number;
  activeEventIds: string[];
  nodeStates: Map<string, TopologyNode["status"]> | Record<string, TopologyNode["status"]>;
  trigger: ReplaySnapshotTrigger;
  revision?: number | null;
}

export interface ScenarioBackendWorkspace {
  organization: ScenarioBackendOrganization;
  viewer: ScenarioBackendUser;
  membership: ScenarioBackendMembership;
  authSession: ScenarioBackendAuthSession;
  activeSsoProvider: ScenarioBackendOidcProvider | null;
  ssoConnections: Array<{
    organization: ScenarioBackendOrganization;
    provider: ScenarioBackendOidcProvider;
    profiles: Array<{
      user: ScenarioBackendUser;
      membership: ScenarioBackendMembership;
    }>;
  }>;
  availableOrganizations: Array<{
    organization: ScenarioBackendOrganization;
    membership: ScenarioBackendMembership;
    storageKey: string;
  }>;
  availableAccessProfiles: Array<{
    user: ScenarioBackendUser;
    membership: ScenarioBackendMembership;
  }>;
  storageStrategy: {
    kind: "tenant-local-storage";
    controlPlaneKey: string;
    tenantStorageKey: string;
    isolationBoundary: "organization";
  };
  permissions: ScenarioWorkspacePermission[];
  preferences: ScenarioBackendState["preferences"];
  entries: ScenarioWorkspaceEntry[];
  activeScenarioId: string | null;
  auditLog: ScenarioAuditEvent[];
  systemLogs: ScenarioBackendSystemLog[];
  telemetrySamples: ScenarioBackendState["telemetrySamples"];
  securityVerifications: ScenarioBackendSecurityVerificationRun[];
  replaySnapshots: ScenarioBackendReplaySnapshot[];
  initialLoadError: string | null;
  lastSyncedAt: string;
}

export interface ScenarioBackendRepository {
  getWorkspace(preferredActiveScenarioId?: string | null): ScenarioBackendWorkspace;
  signInAsUser(userId: string): ScenarioBackendWorkspace;
  signInWithOidc(providerId: string, userId: string): ScenarioBackendWorkspace;
  switchOrganization(organizationId: string): ScenarioBackendWorkspace;
  setMotionMode(motionMode: MotionMode): ScenarioBackendWorkspace;
  runSecurityVerification(): Promise<ScenarioBackendWorkspace>;
  saveScenario(
    scenario: Scenario,
    source: ScenarioVersionSource,
    options?: SaveScenarioOptions,
  ): ScenarioBackendWorkspace;
  selectScenario(
    scenarioId: string,
    options?: { recordAudit?: boolean },
  ): ScenarioBackendWorkspace;
  deleteScenario(scenarioId: string): ScenarioBackendWorkspace;
  publishScenarioRevision(
    scenarioId: string,
    revision: number,
  ): ScenarioBackendWorkspace;
  markScenarioExported(
    scenarioId: string,
    scenarioName: string,
    revision?: number | null,
  ): ScenarioBackendWorkspace;
  captureReplaySnapshot(
    input: CaptureReplaySnapshotInput,
  ): ScenarioBackendWorkspace;
}

export class ScenarioConflictError extends Error {
  constructor(
    public readonly scenarioId: string,
    public readonly attemptedScenario: Scenario,
    public readonly baseVersionId: string | null,
    public readonly latestVersionId: string,
    public readonly latestRevision: number | null,
    public readonly latestScenario: Scenario,
    public readonly latestUpdatedAt: string,
    public readonly latestUpdatedByName: string | null,
  ) {
    super(
      `Scenario ${attemptedScenario.name} changed since this draft was loaded. Refresh to review the latest revision before saving again.`,
    );
    this.name = "ScenarioConflictError";
  }
}

interface LoadedState {
  state: ScenarioBackendState;
  initialLoadError: string | null;
}

interface AuditEventOptions {
  actorUserId?: string | null;
  scenarioName?: string | null;
  revision?: number | null;
  source?: ScenarioVersionSource | null;
  trigger?: ReplaySnapshotTrigger | null;
  currentTime?: number | null;
  activeEventCount?: number | null;
  changeCount?: number | null;
  now?: string;
}

function resolveStorage(storage?: StorageLike) {
  if (storage) return storage;

  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("Local storage is unavailable in this environment.");
  }

  return window.localStorage;
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function resolveNow(now?: string) {
  return now ?? new Date().toISOString();
}

function getDurationStart() {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function getDurationMs(start: number) {
  const end =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  return Number((end - start).toFixed(2));
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "scenario";
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function createSeedActors(now = resolveNow()) {
  const users: ScenarioBackendUser[] = [
    {
      id: "user-story-drift-owner",
      name: "Scenario Architect",
      email: "architect@storydrift.local",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "user-story-drift-admin",
      name: "Incident Commander",
      email: "commander@storydrift.local",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "user-story-drift-editor",
      name: "Platform Engineer",
      email: "platform@storydrift.local",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "user-story-drift-viewer",
      name: "Security Reviewer",
      email: "reviewer@storydrift.local",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const organizations: ScenarioBackendOrganization[] = [
    {
      id: "org-story-drift-labs",
      slug: "story-drift-labs",
      name: "Story Drift Labs",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "org-northstar-retail",
      slug: "northstar-retail",
      name: "Northstar Retail Cloud",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "org-atlas-payments",
      slug: "atlas-payments",
      name: "Atlas Payments Group",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const roleMatrix: Array<
    [string, ScenarioBackendMembership["role"], ScenarioBackendMembership["role"], ScenarioBackendMembership["role"]]
  > = [
    [users[0].id, "owner", "owner", "admin"],
    [users[1].id, "admin", "editor", "viewer"],
    [users[2].id, "editor", "admin", "owner"],
    [users[3].id, "viewer", "viewer", "editor"],
  ];

  const memberships = organizations.flatMap((organization, organizationIndex) =>
    roleMatrix.map(([userId, ...roles]) => ({
      id: `membership-${organization.slug}-${userId}`,
      organizationId: organization.id,
      userId,
      role: roles[organizationIndex],
      createdAt: now,
      updatedAt: now,
    })),
  );

  return {
    users,
    organizations,
    defaultOrganization: organizations[0],
    memberships,
  };
}

function createSeedSsoProviders(
  organizations: ScenarioBackendOrganization[],
  now = resolveNow(),
) {
  const providerCatalog: Array<{
    organizationId: string;
    name: string;
    issuer: string;
    clientId: string;
    domainHint: string | null;
    enforceSso: boolean;
    status: ScenarioBackendOidcProvider["status"];
  }> = [
    {
      organizationId: "org-story-drift-labs",
      name: "Story Drift Okta Workforce",
      issuer: "https://storydrift.okta.example.com/oauth2/default",
      clientId: "storydrift-simulator-web",
      domainHint: "storydrift.local",
      enforceSso: true,
      status: "active",
    },
    {
      organizationId: "org-northstar-retail",
      name: "Northstar Entra ID",
      issuer: "https://login.microsoftonline.com/northstar-retail/v2.0",
      clientId: "northstar-checkout-simulator",
      domainHint: "northstar.example",
      enforceSso: true,
      status: "active",
    },
    {
      organizationId: "org-atlas-payments",
      name: "Atlas PingFederate",
      issuer: "https://identity.atlas-payments.example/as",
      clientId: "atlas-payments-workspace",
      domainHint: "atlas-payments.example",
      enforceSso: false,
      status: "warning",
    },
  ];

  return providerCatalog.flatMap((seed) => {
    const organization = organizations.find((item) => item.id === seed.organizationId);
    if (!organization) return [];

    const slug = organization.slug;
    return [
      {
        id: `oidc-${slug}`,
        organizationId: organization.id,
        name: seed.name,
        status: seed.status,
        issuer: seed.issuer,
        clientId: seed.clientId,
        discoveryUrl: `${seed.issuer}/.well-known/openid-configuration`,
        authorizationEndpoint: `${seed.issuer}/authorize`,
        tokenEndpoint: `${seed.issuer}/token`,
        scopes: ["openid", "profile", "email", "groups"],
        redirectUri: `https://simulator.${slug}.example.com/auth/callback`,
        domainHint: seed.domainHint,
        enforceSso: seed.enforceSso,
        createdAt: now,
        updatedAt: now,
      },
    ];
  });
}

function createAuthSession(
  method: ScenarioBackendAuthMethod,
  organizationId: string,
  user: ScenarioBackendUser,
  options: {
    provider?: ScenarioBackendOidcProvider | null;
    role?: ScenarioBackendMembership["role"] | null;
    now?: string;
  } = {},
): ScenarioBackendAuthSession {
  const now = resolveNow(options.now);
  const provider = options.provider ?? null;
  const expiresAtBase = new Date(now).getTime();
  const subject =
    method === "oidc" && provider
      ? `${provider.organizationId}/${user.id}`
      : `preview:${organizationId}:${user.id}`;

  return {
    id: createId("auth-session"),
    organizationId,
    userId: user.id,
    method,
    providerId: method === "oidc" ? provider?.id ?? null : null,
    providerName: method === "oidc" ? provider?.name ?? null : null,
    issuer: method === "oidc" ? provider?.issuer ?? null : null,
    subject,
    audience: method === "oidc" ? provider?.clientId ?? null : null,
    email: user.email,
    startedAt: now,
    lastAuthenticatedAt: now,
    expiresAt:
      method === "oidc"
        ? new Date(expiresAtBase + 60 * 60 * 1000).toISOString()
        : null,
    claims:
      method === "oidc"
        ? {
            iss: provider?.issuer ?? "",
            aud: provider?.clientId ?? "",
            sub: subject,
            email: user.email,
            email_verified: true,
            org_id: organizationId,
            role: options.role ?? null,
          }
        : {
            mode: "preview",
            org_id: organizationId,
            role: options.role ?? null,
          },
  };
}

function createScenarioVersionRecord(
  scenarioId: string,
  scenario: Scenario,
  revision: number,
  source: ScenarioVersionSource,
  createdByUserId: string,
  now = resolveNow(),
): ScenarioBackendVersionRecord {
  return {
    id: createId("backend-scenario-version"),
    scenarioId,
    revision,
    createdAt: now,
    createdByUserId,
    source,
    scenario,
  };
}

function createScenarioRecord(
  scenario: Scenario,
  organizationId: string,
  createdByUserId: string,
  version: ScenarioBackendVersionRecord,
  origin: ScenarioWorkspaceEntry["origin"],
  publishedVersionId: string | null,
  now = resolveNow(),
): ScenarioBackendRecord {
  return {
    id: scenario.id,
    organizationId,
    slug: slugify(scenario.name),
    origin,
    status: publishedVersionId ? "published" : "draft",
    currentVersionId: version.id,
    publishedVersionId,
    createdAt: now,
    updatedAt: now,
    createdByUserId,
    updatedByUserId: createdByUserId,
  };
}

function combineBackendState(
  control: ScenarioBackendControlState,
  tenant: ScenarioBackendTenantState,
): ScenarioBackendState {
  return {
    schemaVersion: 1,
    currentOrganizationId: control.currentOrganizationId,
    currentUserId: control.currentUserId,
    users: control.users,
    organizations: control.organizations,
    memberships: control.memberships,
    ssoProviders: control.ssoProviders,
    authSession: control.authSession,
    scenarios: tenant.scenarios,
    scenarioVersions: tenant.scenarioVersions,
    replaySnapshots: tenant.replaySnapshots,
    auditEvents: tenant.auditEvents,
    systemLogs: tenant.systemLogs,
    telemetrySamples: tenant.telemetrySamples,
    securityVerifications: tenant.securityVerifications,
    preferences: tenant.preferences,
  };
}

function splitBackendState(state: ScenarioBackendState): {
  control: ScenarioBackendControlState;
  tenant: ScenarioBackendTenantState;
} {
  return {
    control: createEmptyScenarioBackendControlState({
      currentOrganizationId: state.currentOrganizationId,
      currentUserId: state.currentUserId,
      users: state.users,
      organizations: state.organizations,
      memberships: state.memberships,
      ssoProviders: state.ssoProviders,
      authSession: state.authSession,
    }),
    tenant: {
      ...createEmptyScenarioBackendTenantState(state.currentOrganizationId),
      scenarios: state.scenarios,
      scenarioVersions: state.scenarioVersions,
      replaySnapshots: state.replaySnapshots,
      auditEvents: state.auditEvents,
      systemLogs: state.systemLogs,
      telemetrySamples: state.telemetrySamples,
      securityVerifications: state.securityVerifications,
      preferences: state.preferences,
    },
  };
}

function getMembershipForUser(
  state: ScenarioBackendState,
  userId: string | null,
) {
  if (!userId) return null;

  return (
    state.memberships.find(
      (item) =>
        item.organizationId === state.currentOrganizationId &&
        item.userId === userId,
    ) ?? null
  );
}

function resolveScenarioName(
  state: ScenarioBackendState,
  scenarioId: string,
  revision?: number | null,
) {
  const version = resolveVersionForSnapshot(state, scenarioId, revision);
  if (version) {
    return version.scenario.name;
  }

  return state.scenarios.find((item) => item.id === scenarioId)?.slug ?? scenarioId;
}

function buildDraftUpdateMessage(
  scenarioName: string,
  changeCount = 1,
) {
  return changeCount > 1
    ? `Updated draft ${scenarioName} (${changeCount} changes)`
    : `Updated draft ${scenarioName}`;
}

function toMembershipRole(
  value: string | null | undefined,
): ScenarioBackendMembership["role"] | null {
  switch (value) {
    case "owner":
    case "admin":
    case "editor":
    case "viewer":
      return value;
    default:
      return null;
  }
}

function createAuditEvent(
  state: ScenarioBackendState,
  scenarioId: string,
  type: ScenarioAuditEvent["type"],
  message: string,
  options: AuditEventOptions = {},
): ScenarioBackendAuditEvent {
  const actorUserId = options.actorUserId ?? state.currentUserId;
  const actor = actorUserId
    ? state.users.find((item) => item.id === actorUserId) ?? null
    : null;
  const membership = getMembershipForUser(state, actorUserId);
  const revision = options.revision ?? null;
  const scenarioName = options.scenarioName ?? resolveScenarioName(state, scenarioId, revision);
  const now = resolveNow(options.now);

  return {
    id: createId("backend-audit"),
    organizationId: state.currentOrganizationId,
    scenarioId,
    actorUserId,
    type,
    message,
    createdAt: now,
    actorName: actor?.name ?? null,
    actorEmail: actor?.email ?? null,
    actorRole: membership?.role ?? null,
    scenarioName,
    revision,
    source: options.source ?? null,
    trigger: options.trigger ?? null,
    currentTime: options.currentTime ?? null,
    activeEventCount: options.activeEventCount ?? null,
    changeCount: options.changeCount ?? null,
  };
}

function shouldCoalesceAuditEvent(
  existing: ScenarioBackendAuditEvent,
  incoming: ScenarioBackendAuditEvent,
) {
  if (existing.type !== "scenario.updated" || incoming.type !== "scenario.updated") {
    return false;
  }

  if (existing.source !== "edit" || incoming.source !== "edit") {
    return false;
  }

  if (
    existing.scenarioId !== incoming.scenarioId ||
    existing.actorUserId !== incoming.actorUserId
  ) {
    return false;
  }

  const existingTime = Date.parse(existing.createdAt);
  const incomingTime = Date.parse(incoming.createdAt);
  if (Number.isNaN(existingTime) || Number.isNaN(incomingTime)) {
    return false;
  }

  return incomingTime - existingTime <= 45_000;
}

function appendAuditEvent(
  events: ScenarioBackendAuditEvent[],
  incoming: ScenarioBackendAuditEvent,
) {
  const previous = events[events.length - 1];

  if (!previous || !shouldCoalesceAuditEvent(previous, incoming)) {
    return trimAuditEvents([...events, incoming]);
  }

  const changeCount = (previous.changeCount ?? 1) + (incoming.changeCount ?? 1);
  const merged = {
    ...incoming,
    id: previous.id,
    changeCount,
    message: buildDraftUpdateMessage(
      incoming.scenarioName ?? previous.scenarioName ?? incoming.scenarioId,
      changeCount,
    ),
  };

  return trimAuditEvents([...events.slice(0, -1), merged]);
}

function sortScenarioRecords(
  left: ScenarioBackendRecord,
  right: ScenarioBackendRecord,
) {
  if (left.origin !== right.origin) {
    return left.origin === "builtin" ? -1 : 1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

function buildWorkspaceEntries(state: ScenarioBackendState) {
  const versionMap = new Map<string, ScenarioBackendVersionRecord[]>();

  for (const version of state.scenarioVersions) {
    const list = versionMap.get(version.scenarioId) ?? [];
    list.push(version);
    versionMap.set(version.scenarioId, list);
  }

  return state.scenarios
    .slice()
    .sort(sortScenarioRecords)
    .map((record) => {
      const versions = (versionMap.get(record.id) ?? [])
        .slice()
        .sort((left, right) => left.revision - right.revision)
        .map<ScenarioVersionRecord>((version) => ({
          id: version.id,
          revision: version.revision,
          createdAt: version.createdAt,
          source: version.source,
          scenario: version.scenario,
        }));

      return {
        id: record.id,
        scenarioId: record.id,
        origin: record.origin,
        currentVersionId: record.currentVersionId,
        publishedVersionId: record.publishedVersionId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        versions,
      } satisfies ScenarioWorkspaceEntry;
    });
}

function buildAuditLog(state: ScenarioBackendState) {
  return state.auditEvents
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map<ScenarioAuditEvent>((event) => {
      const actor = event.actorUserId
        ? state.users.find((item) => item.id === event.actorUserId) ?? null
        : null;
      const membership = getMembershipForUser(state, event.actorUserId);
      const version = resolveVersionForSnapshot(
        state,
        event.scenarioId,
        event.revision,
      );

      return {
        id: event.id,
        type: event.type,
        scenarioId: event.scenarioId,
        createdAt: event.createdAt,
        message: event.message,
        actorUserId: event.actorUserId,
        actorName: event.actorName ?? actor?.name ?? null,
        actorEmail: event.actorEmail ?? actor?.email ?? null,
        actorRole: event.actorRole ?? membership?.role ?? null,
        scenarioName: event.scenarioName ?? version?.scenario.name ?? event.scenarioId,
        revision: event.revision ?? version?.revision ?? null,
        source: event.source ?? null,
        trigger: event.trigger ?? null,
        currentTime: event.currentTime ?? null,
        activeEventCount: event.activeEventCount ?? null,
        changeCount: event.changeCount ?? null,
      };
    });
}

function buildWorkspaceView(
  loaded: LoadedState,
  preferredActiveScenarioId?: string | null,
): ScenarioBackendWorkspace {
  const state = loaded.state;
  const entries = buildWorkspaceEntries(state);
  const activeScenarioId =
    preferredActiveScenarioId &&
    entries.some((entry) => entry.scenarioId === preferredActiveScenarioId)
      ? preferredActiveScenarioId
      : state.preferences.activeScenarioId &&
          entries.some((entry) => entry.scenarioId === state.preferences.activeScenarioId)
        ? state.preferences.activeScenarioId
        : entries[0]?.scenarioId ?? null;

  const organization = state.organizations.find(
    (item) => item.id === state.currentOrganizationId,
  );
  const viewer = state.users.find((item) => item.id === state.currentUserId);
  const membership = state.memberships.find(
    (item) =>
      item.organizationId === state.currentOrganizationId &&
      item.userId === state.currentUserId,
  );
  const availableOrganizations = state.memberships
    .filter((item) => item.userId === state.currentUserId)
    .map((item) => ({
      membership: item,
      organization: state.organizations.find(
        (organizationItem) => organizationItem.id === item.organizationId,
      ),
    }))
    .filter(
      (
        item,
      ): item is {
        membership: ScenarioBackendMembership;
        organization: ScenarioBackendOrganization;
      } => Boolean(item.organization),
    )
    .sort((left, right) => left.organization.name.localeCompare(right.organization.name))
    .map((item) => ({
      ...item,
      storageKey: getScenarioBackendTenantStorageKey(item.organization.id),
    }));
  const availableAccessProfiles = state.memberships
    .filter((item) => item.organizationId === state.currentOrganizationId)
    .map((item) => ({
      membership: item,
      user: state.users.find((user) => user.id === item.userId),
    }))
    .filter((item): item is { membership: ScenarioBackendMembership; user: ScenarioBackendUser } => Boolean(item.user))
    .sort((left, right) => left.user.name.localeCompare(right.user.name));
  const activeSsoProvider =
    state.ssoProviders.find(
      (item) => item.organizationId === state.currentOrganizationId,
    ) ?? null;
  const authSession =
    state.authSession ??
    createAuthSession(
      "preview",
      state.currentOrganizationId,
      viewer ?? state.users[0],
      {
        role: membership?.role ?? null,
        provider: activeSsoProvider,
      },
    );
  const ssoConnections = state.ssoProviders
    .map((provider) => ({
      provider,
      organization: state.organizations.find(
        (item) => item.id === provider.organizationId,
      ),
      profiles: state.memberships
        .filter((item) => item.organizationId === provider.organizationId)
        .map((membershipItem) => ({
          membership: membershipItem,
          user: state.users.find((userItem) => userItem.id === membershipItem.userId),
        }))
        .filter(
          (
            item,
          ): item is {
            membership: ScenarioBackendMembership;
            user: ScenarioBackendUser;
          } => Boolean(item.user),
        )
        .sort((left, right) => left.user.name.localeCompare(right.user.name)),
    }))
    .filter(
      (
        item,
      ): item is {
        organization: ScenarioBackendOrganization;
        provider: ScenarioBackendOidcProvider;
        profiles: Array<{
          user: ScenarioBackendUser;
          membership: ScenarioBackendMembership;
        }>;
      } => Boolean(item.organization),
    )
    .sort((left, right) => left.organization.name.localeCompare(right.organization.name));

  if (!organization || !viewer || !membership) {
    throw new Error("Backend seed data is incomplete.");
  }

  return {
    organization,
    viewer,
    membership,
    authSession,
    activeSsoProvider,
    ssoConnections,
    availableOrganizations,
    availableAccessProfiles,
    storageStrategy: {
      kind: "tenant-local-storage",
      controlPlaneKey: SCENARIO_BACKEND_CONTROL_STORAGE_KEY,
      tenantStorageKey: getScenarioBackendTenantStorageKey(
        state.currentOrganizationId,
      ),
      isolationBoundary: "organization",
    },
    permissions: getPermissionsForRole(membership.role),
    preferences: state.preferences,
    entries,
    activeScenarioId,
    auditLog: buildAuditLog(state),
    systemLogs: state.systemLogs
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    telemetrySamples: state.telemetrySamples
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    securityVerifications: state.securityVerifications
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    replaySnapshots: state.replaySnapshots
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    initialLoadError: loaded.initialLoadError,
    lastSyncedAt: resolveNow(),
  };
}

function clearLegacyWorkspaceStorage(storage: StorageLike) {
  storage.removeItem(PHASE2_WORKSPACE_STORAGE_KEY);
  storage.removeItem("story-drift-studio/custom-scenarios/v1");
  storage.removeItem("story-drift-studio/active-scenario-id/v1");
}

function normalizeControlState(
  control: ScenarioBackendControlState,
): ScenarioBackendControlState {
  const currentOrganizationId = control.organizations.some(
    (item) => item.id === control.currentOrganizationId,
  )
    ? control.currentOrganizationId
    : control.organizations[0]?.id ?? control.currentOrganizationId;
  const membershipsInOrganization = control.memberships.filter(
    (item) => item.organizationId === currentOrganizationId,
  );
  const currentUserId = membershipsInOrganization.some(
    (item) => item.userId === control.currentUserId,
  )
    ? control.currentUserId
    : membershipsInOrganization[0]?.userId ?? control.currentUserId;
  const ssoProviders =
    control.ssoProviders.length > 0
      ? control.ssoProviders
      : createSeedSsoProviders(control.organizations);
  const currentUser = control.users.find((item) => item.id === currentUserId) ?? null;
  const currentMembership =
    control.memberships.find(
      (item) =>
        item.organizationId === currentOrganizationId &&
        item.userId === currentUserId,
    ) ?? null;
  const currentProvider =
    ssoProviders.find((item) => item.organizationId === currentOrganizationId) ?? null;
  const authSession =
    control.authSession &&
    control.authSession.organizationId === currentOrganizationId &&
    control.authSession.userId === currentUserId
      ? control.authSession
      : currentUser
        ? createAuthSession("preview", currentOrganizationId, currentUser, {
            role: currentMembership?.role ?? null,
            provider: currentProvider,
          })
        : null;

  return {
    ...control,
    currentOrganizationId,
    currentUserId,
    ssoProviders,
    authSession,
  };
}

function createSeedControlState(now = resolveNow()) {
  const actors = createSeedActors(now);
  const ssoProviders = createSeedSsoProviders(actors.organizations, now);
  const authSession = createAuthSession(
    "preview",
    actors.defaultOrganization.id,
    actors.users[0],
    {
      role:
        actors.memberships.find(
          (item) =>
            item.organizationId === actors.defaultOrganization.id &&
            item.userId === actors.users[0].id,
        )?.role ?? null,
      provider:
        ssoProviders.find(
          (item) => item.organizationId === actors.defaultOrganization.id,
        ) ?? null,
      now,
    },
  );

  return createEmptyScenarioBackendControlState({
    currentOrganizationId: actors.defaultOrganization.id,
    currentUserId: actors.users[0].id,
    users: actors.users,
    organizations: actors.organizations,
    memberships: actors.memberships,
    ssoProviders,
    authSession,
  });
}

function migratePhase2WorkspaceState(
  raw: string,
  control: ScenarioBackendControlState,
): ScenarioBackendTenantState {
  const parsed = parseScenarioWorkspaceState(JSON.parse(raw));
  const nextState = createEmptyScenarioBackendTenantState(
    control.currentOrganizationId,
  );
  nextState.auditEvents = parsed.auditLog.map((event) => ({
      id: event.id,
      organizationId: control.currentOrganizationId,
      scenarioId: event.scenarioId,
      actorUserId: event.actorUserId ?? control.currentUserId,
      type: event.type,
      message: event.message,
      createdAt: event.createdAt,
      actorName: event.actorName ?? null,
      actorEmail: event.actorEmail ?? null,
      actorRole: toMembershipRole(event.actorRole),
      scenarioName: event.scenarioName ?? null,
      revision: event.revision ?? null,
      source: event.source ?? null,
      trigger: event.trigger ?? null,
      currentTime: event.currentTime ?? null,
      activeEventCount: event.activeEventCount ?? null,
      changeCount: event.changeCount ?? null,
    }));
  nextState.preferences = {
    activeScenarioId: parsed.activeScenarioId,
    motionMode: "system",
  };

  for (const entry of parsed.customEntries) {
    const versions = entry.versions.map((version) => ({
      id: version.id,
      scenarioId: entry.scenarioId,
      revision: version.revision,
      createdAt: version.createdAt,
      createdByUserId: control.currentUserId,
      source: version.source,
      scenario: version.scenario,
    }));

    nextState.scenarioVersions.push(...versions);
    nextState.scenarios.push({
      id: entry.scenarioId,
      organizationId: control.currentOrganizationId,
      slug: slugify(versions[versions.length - 1].scenario.name),
      origin: "custom",
      status: entry.publishedVersionId ? "published" : "draft",
      currentVersionId: entry.currentVersionId,
      publishedVersionId: entry.publishedVersionId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      createdByUserId: control.currentUserId,
      updatedByUserId: control.currentUserId,
    });
  }

  return nextState;
}

function migrateLegacyWorkspaceState(
  storage: StorageLike,
  control: ScenarioBackendControlState,
): ScenarioBackendTenantState | null {
  const customScenarios = loadStoredCustomScenarios(storage);
  const activeScenarioId = loadStoredActiveScenarioId(storage);

  if (customScenarios.length === 0 && !activeScenarioId) {
    return null;
  }

  const nextState = createEmptyScenarioBackendTenantState(
    control.currentOrganizationId,
  );
  nextState.preferences = {
    activeScenarioId,
    motionMode: "system",
  };

  for (const scenario of customScenarios) {
    const version = createScenarioVersionRecord(
      scenario.id,
      scenario,
      1,
      "builder",
      control.currentUserId,
      control.organizations[0].createdAt,
    );
    nextState.scenarioVersions.push(version);
    nextState.scenarios.push(
      createScenarioRecord(
        scenario,
        control.currentOrganizationId,
        control.currentUserId,
        version,
        "custom",
        null,
        version.createdAt,
      ),
    );
  }

  return nextState;
}

function migrateLegacyBackendState(
  raw: string,
  fallbackControl: ScenarioBackendControlState,
): {
  control: ScenarioBackendControlState;
  tenants: ScenarioBackendTenantState[];
} {
  const legacyState = parseScenarioBackendState(JSON.parse(raw));
  const control = normalizeControlState({
    ...fallbackControl,
    currentOrganizationId: fallbackControl.organizations.some(
      (item) => item.id === legacyState.currentOrganizationId,
    )
      ? legacyState.currentOrganizationId
      : fallbackControl.currentOrganizationId,
    currentUserId: fallbackControl.users.some(
      (item) => item.id === legacyState.currentUserId,
    )
      ? legacyState.currentUserId
      : fallbackControl.currentUserId,
  });
  const organizationIds = new Set<string>();

  legacyState.scenarios.forEach((item) => organizationIds.add(item.organizationId));
  legacyState.replaySnapshots.forEach((item) => organizationIds.add(item.organizationId));
  legacyState.auditEvents.forEach((item) => organizationIds.add(item.organizationId));
  legacyState.systemLogs.forEach((item) => {
    organizationIds.add(item.organizationId ?? control.currentOrganizationId);
  });

  if (organizationIds.size === 0) {
    organizationIds.add(control.currentOrganizationId);
  }

  const tenants = Array.from(organizationIds).map((organizationId) => {
    const scenarioIds = new Set(
      legacyState.scenarios
        .filter((item) => item.organizationId === organizationId)
        .map((item) => item.id),
    );

    return {
      ...createEmptyScenarioBackendTenantState(organizationId),
      scenarios: legacyState.scenarios.filter(
        (item) => item.organizationId === organizationId,
      ),
      scenarioVersions: legacyState.scenarioVersions.filter((item) =>
        scenarioIds.has(item.scenarioId),
      ),
      replaySnapshots: legacyState.replaySnapshots.filter(
        (item) => item.organizationId === organizationId,
      ),
      auditEvents: legacyState.auditEvents.filter(
        (item) => item.organizationId === organizationId,
      ),
      systemLogs: legacyState.systemLogs.filter(
        (item) => (item.organizationId ?? control.currentOrganizationId) === organizationId,
      ),
      preferences: {
        activeScenarioId:
          organizationId === control.currentOrganizationId
            ? legacyState.preferences.activeScenarioId
            : null,
        motionMode:
          organizationId === control.currentOrganizationId
            ? legacyState.preferences.motionMode
            : "system",
      },
    };
  });

  return { control, tenants };
}

function ensureTenantState(
  storage: StorageLike,
  control: ScenarioBackendControlState,
  builtInScenarios: Scenario[],
  tenantOverride?: ScenarioBackendTenantState | null,
): ScenarioBackendTenantState {
  const tenantStorageKey = getScenarioBackendTenantStorageKey(
    control.currentOrganizationId,
  );
  const rawTenant = storage.getItem(tenantStorageKey);
  const tenant =
    tenantOverride ??
    (rawTenant
      ? parseScenarioBackendTenantState(JSON.parse(rawTenant))
      : createEmptyScenarioBackendTenantState(control.currentOrganizationId));
  const normalizedState = flushBufferedSystemLogsIntoState(
    normalizeActiveScenarioPreference(
      ensureBuiltinCatalog(combineBackendState(control, tenant), builtInScenarios),
    ),
    storage,
  );
  const stateWithTelemetry = flushBufferedTelemetrySamplesIntoState(
    normalizedState,
    storage,
  );
  const { tenant: normalizedTenant } = splitBackendState(stateWithTelemetry);

  storage.setItem(tenantStorageKey, JSON.stringify(normalizedTenant));
  return normalizedTenant;
}

function persistControlState(
  storage: StorageLike,
  control: ScenarioBackendControlState,
) {
  storage.setItem(
    SCENARIO_BACKEND_CONTROL_STORAGE_KEY,
    JSON.stringify(normalizeControlState(control)),
  );
}

function persistTenantState(
  storage: StorageLike,
  tenant: ScenarioBackendTenantState,
) {
  storage.setItem(
    getScenarioBackendTenantStorageKey(tenant.organizationId),
    JSON.stringify(tenant),
  );
}

function ensureBuiltinCatalog(
  state: ScenarioBackendState,
  builtInScenarios: Scenario[],
): ScenarioBackendState {
  const nextState: ScenarioBackendState = {
    ...state,
    scenarios: [...state.scenarios],
    scenarioVersions: [...state.scenarioVersions],
  };

  for (const scenario of builtInScenarios) {
    const existingRecord = nextState.scenarios.find(
      (record) => record.id === scenario.id && record.origin === "builtin",
    );

    if (!existingRecord) {
      const version = createScenarioVersionRecord(
        scenario.id,
        scenario,
        1,
        "builtin",
        nextState.currentUserId,
      );
      nextState.scenarioVersions.push(version);
      nextState.scenarios.push(
        createScenarioRecord(
          scenario,
          nextState.currentOrganizationId,
          nextState.currentUserId,
          version,
          "builtin",
          version.id,
          version.createdAt,
        ),
      );
      continue;
    }

    const currentVersion = nextState.scenarioVersions.find(
      (version) => version.id === existingRecord.currentVersionId,
    );

    if (!currentVersion) {
      const replacementVersion = createScenarioVersionRecord(
        scenario.id,
        scenario,
        1,
        "builtin",
        nextState.currentUserId,
      );
      nextState.scenarioVersions = nextState.scenarioVersions.filter(
        (version) => version.scenarioId !== scenario.id,
      );
      nextState.scenarioVersions.push(replacementVersion);
      Object.assign(existingRecord, {
        slug: slugify(scenario.name),
        currentVersionId: replacementVersion.id,
        publishedVersionId: replacementVersion.id,
        status: "published",
        updatedAt: replacementVersion.createdAt,
        updatedByUserId: nextState.currentUserId,
      });
      continue;
    }

    currentVersion.scenario = scenario;
    currentVersion.source = "builtin";
    existingRecord.slug = slugify(scenario.name);
    existingRecord.publishedVersionId = currentVersion.id;
    existingRecord.status = "published";
  }

  return nextState;
}

function normalizeActiveScenarioPreference(state: ScenarioBackendState) {
  const hasActiveScenario =
    state.preferences.activeScenarioId != null &&
    state.scenarios.some((record) => record.id === state.preferences.activeScenarioId);

  return {
    ...state,
    preferences: {
      activeScenarioId: hasActiveScenario
        ? state.preferences.activeScenarioId
        : state.scenarios
            .slice()
            .sort(sortScenarioRecords)[0]?.id ?? null,
      motionMode: state.preferences.motionMode,
    },
  };
}

function loadState(
  storage: StorageLike,
  builtInScenarios: Scenario[],
): LoadedState {
  const seedControl = createSeedControlState();
  let control = seedControl;
  let initialLoadError: string | null = null;
  let tenantOverride: ScenarioBackendTenantState | null = null;

  try {
    const rawControl = storage.getItem(SCENARIO_BACKEND_CONTROL_STORAGE_KEY);
    const rawLegacyBackend = storage.getItem(SCENARIO_BACKEND_STORAGE_KEY);
    const phase2Raw = storage.getItem(PHASE2_WORKSPACE_STORAGE_KEY);

    if (rawControl) {
      control = normalizeControlState(
        parseScenarioBackendControlState(JSON.parse(rawControl)),
      );
    } else if (rawLegacyBackend) {
      const migrated = migrateLegacyBackendState(rawLegacyBackend, seedControl);
      control = normalizeControlState(migrated.control);
      persistControlState(storage, control);
      migrated.tenants.forEach((tenant) => persistTenantState(storage, tenant));
      storage.removeItem(SCENARIO_BACKEND_STORAGE_KEY);
      clearLegacyWorkspaceStorage(storage);
    } else if (phase2Raw) {
      control = seedControl;
      tenantOverride = migratePhase2WorkspaceState(phase2Raw, control);
      persistControlState(storage, control);
      clearLegacyWorkspaceStorage(storage);
    } else {
      control = seedControl;
      tenantOverride = migrateLegacyWorkspaceState(storage, control);
      persistControlState(storage, control);
      if (tenantOverride) {
        clearLegacyWorkspaceStorage(storage);
      }
    }

    persistControlState(storage, control);
  } catch (error) {
    initialLoadError = error instanceof Error ? error.message : String(error);
    control = seedControl;
    persistControlState(storage, control);
    storage.removeItem(SCENARIO_BACKEND_STORAGE_KEY);
  }

  try {
    const tenant = ensureTenantState(
      storage,
      control,
      builtInScenarios,
      tenantOverride,
    );

    return {
      state: combineBackendState(control, tenant),
      initialLoadError,
    };
  } catch (error) {
    const recoveredTenant = ensureTenantState(
      storage,
      control,
      builtInScenarios,
      createEmptyScenarioBackendTenantState(control.currentOrganizationId),
    );

    return {
      state: combineBackendState(control, recoveredTenant),
      initialLoadError:
        initialLoadError ?? (error instanceof Error ? error.message : String(error)),
    };
  }
}

function writeState(storage: StorageLike, state: ScenarioBackendState) {
  const { control, tenant } = splitBackendState(state);
  persistControlState(storage, control);
  persistTenantState(storage, tenant);
}

function upsertScenarioState(
  state: ScenarioBackendState,
  scenario: Scenario,
  source: ScenarioVersionSource,
  options: SaveScenarioOptions = {},
): ScenarioBackendState {
  const now = resolveNow();
  const membership = state.memberships.find(
    (item) =>
      item.organizationId === state.currentOrganizationId &&
      item.userId === state.currentUserId,
  );
  if (!membership) {
    throw new Error("Active membership was not found for the current user.");
  }

  const requiredPermission =
    source === "builder"
      ? "scenario.create"
      : source === "import"
        ? "scenario.import"
        : "scenario.edit";
  assertScenarioPermission(
    membership.role,
    requiredPermission,
    `Your ${membership.role} role cannot ${requiredPermission.replace("scenario.", "")} scenarios.`,
  );

  const recordVersion = options.recordVersion ?? source !== "edit";
  const recordAudit = options.recordAudit ?? true;
  const nextState: ScenarioBackendState = {
    ...state,
    scenarios: [...state.scenarios],
    scenarioVersions: [...state.scenarioVersions],
    auditEvents: [...state.auditEvents],
    preferences: {
      ...state.preferences,
      activeScenarioId: scenario.id,
    },
  };

  const existingRecord = nextState.scenarios.find(
    (record) => record.id === scenario.id && record.origin === "custom",
  );

  if (!existingRecord) {
    const version = createScenarioVersionRecord(
      scenario.id,
      scenario,
      1,
      source,
      nextState.currentUserId,
      now,
    );
    nextState.scenarioVersions.push(version);
    nextState.scenarios.push(
      createScenarioRecord(
        scenario,
        nextState.currentOrganizationId,
        nextState.currentUserId,
        version,
        "custom",
        null,
        now,
      ),
    );

    if (recordAudit) {
      nextState.auditEvents = appendAuditEvent(
        nextState.auditEvents,
        createAuditEvent(
          nextState,
          scenario.id,
          source === "import" ? "scenario.imported" : "scenario.created",
          source === "import"
            ? `Imported scenario ${scenario.name}`
            : `Created scenario ${scenario.name}`,
          {
            actorUserId: nextState.currentUserId,
            now,
            scenarioName: scenario.name,
            revision: version.revision,
            source,
          },
        ),
      );
    }

    return nextState;
  }

  if (
    (options.baseVersionId != null || options.baseUpdatedAt != null) &&
    (
      (options.baseVersionId != null &&
        existingRecord.currentVersionId !== options.baseVersionId) ||
      (options.baseUpdatedAt != null &&
        existingRecord.updatedAt !== options.baseUpdatedAt)
    )
  ) {
    const latestVersion =
      nextState.scenarioVersions.find(
        (version) => version.id === existingRecord.currentVersionId,
      ) ?? null;
    const latestEditor =
      nextState.users.find((user) => user.id === existingRecord.updatedByUserId) ?? null;

    if (latestVersion) {
      throw new ScenarioConflictError(
        scenario.id,
        scenario,
        options.baseVersionId,
        latestVersion.id,
        latestVersion.revision,
        latestVersion.scenario,
        existingRecord.updatedAt,
        latestEditor?.name ?? null,
      );
    }
  }

  const currentVersionIndex = nextState.scenarioVersions.findIndex(
    (version) => version.id === existingRecord.currentVersionId,
  );
  const scenarioVersions = nextState.scenarioVersions.filter(
    (version) => version.scenarioId === existingRecord.id,
  );
  const nextRevision =
    Math.max(...scenarioVersions.map((version) => version.revision), 0) + 1;

  if (recordVersion || currentVersionIndex === -1) {
    const version = createScenarioVersionRecord(
      scenario.id,
      scenario,
      nextRevision,
      source,
      nextState.currentUserId,
      now,
    );
    nextState.scenarioVersions.push(version);
    Object.assign(existingRecord, {
      slug: slugify(scenario.name),
      currentVersionId: version.id,
      updatedAt: now,
      updatedByUserId: nextState.currentUserId,
      status: existingRecord.publishedVersionId ? "published" : "draft",
    });
  } else {
    nextState.scenarioVersions[currentVersionIndex] = {
      ...nextState.scenarioVersions[currentVersionIndex],
      source,
      scenario,
    };
    Object.assign(existingRecord, {
      slug: slugify(scenario.name),
      updatedAt: now,
      updatedByUserId: nextState.currentUserId,
    });
  }

  if (recordAudit) {
    const activeVersion =
      nextState.scenarioVersions.find(
        (version) => version.id === existingRecord.currentVersionId,
      ) ?? null;
    const changeCount = source === "edit" ? 1 : null;
    const message =
      source === "import"
        ? `Imported scenario ${scenario.name}`
        : source === "edit"
          ? buildDraftUpdateMessage(scenario.name, changeCount ?? 1)
          : `Updated scenario ${scenario.name}`;

    nextState.auditEvents = appendAuditEvent(
      nextState.auditEvents,
      createAuditEvent(
        nextState,
        scenario.id,
        source === "import" ? "scenario.imported" : "scenario.updated",
        message,
        {
          actorUserId: nextState.currentUserId,
          now,
          scenarioName: scenario.name,
          revision: activeVersion?.revision ?? null,
          source,
          changeCount,
        },
      ),
    );
  }

  return nextState;
}

function resolveVersionForSnapshot(
  state: ScenarioBackendState,
  scenarioId: string,
  revision?: number | null,
) {
  const record = state.scenarios.find((item) => item.id === scenarioId);
  if (!record) return null;

  if (revision != null) {
    const requestedVersion = state.scenarioVersions.find(
      (version) => version.scenarioId === scenarioId && version.revision === revision,
    );
    if (requestedVersion) {
      return requestedVersion;
    }
  }

  return (
    state.scenarioVersions.find((version) => version.id === record.currentVersionId) ??
    null
  );
}

function toNodeStatesRecord(
  nodeStates: Map<string, TopologyNode["status"]> | Record<string, TopologyNode["status"]>,
) {
  if (nodeStates instanceof Map) {
    return Object.fromEntries(nodeStates.entries());
  }

  return nodeStates;
}

function trimReplaySnapshots(snapshots: ScenarioBackendReplaySnapshot[]) {
  return snapshots
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 150);
}

function trimSecurityVerifications(runs: ScenarioBackendSecurityVerificationRun[]) {
  return runs
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 20);
}

function trimAuditEvents(events: ScenarioBackendAuditEvent[]) {
  return events
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(-200);
}

export function createMockScenarioBackendRepository(
  builtInScenarios: Scenario[],
  storage?: StorageLike,
): ScenarioBackendRepository {
  const safeStorage = resolveStorage(storage);

  function readLoadedState() {
    return loadState(safeStorage, builtInScenarios);
  }

  function persistAndBuild(state: ScenarioBackendState, initialLoadError: string | null) {
    const normalizedState = normalizeActiveScenarioPreference(state);
    writeState(safeStorage, normalizedState);
    return buildWorkspaceView(
      {
        state: normalizedState,
        initialLoadError,
      },
      normalizedState.preferences.activeScenarioId,
    );
  }

  function recordBackendLatencySample(
    input: {
      scope:
        | "auth"
        | "storage"
        | "scenario"
        | "workspace"
        | "security"
        | "replay";
      name: string;
      startedAt: number;
      scenarioId?: string | null;
      scenarioName?: string | null;
      details?: Record<string, unknown>;
      status?: "ok" | "warn" | "error";
    },
  ) {
    recordTelemetrySample(
      {
        source: "mock-backend",
        scope: input.scope,
        name: input.name,
        value: getDurationMs(input.startedAt),
        unit: "ms",
        status: input.status ?? "ok",
        scenarioId: input.scenarioId ?? null,
        scenarioName: input.scenarioName ?? null,
        details: input.details,
      },
      safeStorage,
    );
  }

  return {
    getWorkspace(preferredActiveScenarioId) {
      const loaded = readLoadedState();
      if (
        preferredActiveScenarioId &&
        loaded.state.preferences.activeScenarioId !== preferredActiveScenarioId &&
        loaded.state.scenarios.some((record) => record.id === preferredActiveScenarioId)
      ) {
        loaded.state = {
          ...loaded.state,
          preferences: {
            ...loaded.state.preferences,
            activeScenarioId: preferredActiveScenarioId,
          },
        };
        writeState(safeStorage, loaded.state);
      }

      return buildWorkspaceView(loaded, preferredActiveScenarioId);
    },
    signInAsUser(userId) {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();
      const membership = loaded.state.memberships.find(
        (item) =>
          item.organizationId === loaded.state.currentOrganizationId &&
          item.userId === userId,
      );
      if (!membership) {
        throw new Error("That user is not a member of the current organization.");
      }

      const nextState: ScenarioBackendState = {
        ...loaded.state,
        currentUserId: userId,
        authSession: createAuthSession(
          "preview",
          loaded.state.currentOrganizationId,
          loaded.state.users.find((item) => item.id === userId) ?? loaded.state.users[0],
          {
            role: membership.role,
            provider:
              loaded.state.ssoProviders.find(
                (item) => item.organizationId === loaded.state.currentOrganizationId,
              ) ?? null,
          },
        ),
      };

      const workspace = persistAndBuild(nextState, loaded.initialLoadError);
      recordBackendLatencySample({
        scope: "auth",
        name: "auth.preview_sign_in",
        startedAt,
        details: {
          targetUserId: userId,
          role: membership.role,
        },
      });
      return workspace;
    },
    signInWithOidc(providerId, userId) {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();
      const provider = loaded.state.ssoProviders.find((item) => item.id === providerId);
      if (!provider) {
        recordBackendLatencySample({
          scope: "auth",
          name: "auth.oidc_sign_in",
          startedAt,
          status: "error",
          details: {
            providerId,
            targetUserId: userId,
            reason: "provider_not_found",
          },
        });
        throw new Error("That OIDC provider is not configured.");
      }

      const user = loaded.state.users.find((item) => item.id === userId);
      const membership = loaded.state.memberships.find(
        (item) =>
          item.organizationId === provider.organizationId &&
          item.userId === userId,
      );
      if (!user || !membership) {
        recordBackendLatencySample({
          scope: "auth",
          name: "auth.oidc_sign_in",
          startedAt,
          status: "error",
          details: {
            providerId,
            targetUserId: userId,
            reason: "membership_not_found",
          },
        });
        throw new Error("That user is not assigned to the selected SSO workspace.");
      }

      const { control } = splitBackendState(loaded.state);
      const nextControl = normalizeControlState({
        ...control,
        currentOrganizationId: provider.organizationId,
        currentUserId: userId,
        authSession: createAuthSession("oidc", provider.organizationId, user, {
          provider,
          role: membership.role,
        }),
      });

      persistControlState(safeStorage, nextControl);
      const tenant = ensureTenantState(safeStorage, nextControl, builtInScenarios);

      const workspace = buildWorkspaceView(
        {
          state: combineBackendState(nextControl, tenant),
          initialLoadError: loaded.initialLoadError,
        },
        tenant.preferences.activeScenarioId,
      );
      recordBackendLatencySample({
        scope: "auth",
        name: "auth.oidc_sign_in",
        startedAt,
        details: {
          providerId,
          targetUserId: userId,
          organizationId: provider.organizationId,
          role: membership.role,
        },
      });
      return workspace;
    },
    switchOrganization(organizationId) {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();
      const organization = loaded.state.organizations.find(
        (item) => item.id === organizationId,
      );
      if (!organization) {
        recordBackendLatencySample({
          scope: "workspace",
          name: "workspace.switch_organization",
          startedAt,
          status: "error",
          details: {
            organizationId,
            reason: "organization_not_found",
          },
        });
        throw new Error("That workspace was not found.");
      }

      const membershipForCurrentUser = loaded.state.memberships.find(
        (item) =>
          item.organizationId === organizationId &&
          item.userId === loaded.state.currentUserId,
      );
      const fallbackMembership = loaded.state.memberships.find(
        (item) => item.organizationId === organizationId,
      );
      const nextUserId =
        membershipForCurrentUser?.userId ??
        fallbackMembership?.userId ??
        loaded.state.currentUserId;

      if (!fallbackMembership) {
        recordBackendLatencySample({
          scope: "workspace",
          name: "workspace.switch_organization",
          startedAt,
          status: "error",
          details: {
            organizationId,
            reason: "membership_not_found",
          },
        });
        throw new Error("No access profile is available for that workspace.");
      }
      const nextMembership = membershipForCurrentUser ?? fallbackMembership;

      const { control } = splitBackendState(loaded.state);
      const nextControl = normalizeControlState({
        ...control,
        currentOrganizationId: organizationId,
        currentUserId: nextUserId,
        authSession: createAuthSession(
          "preview",
          organizationId,
          loaded.state.users.find((item) => item.id === nextUserId) ?? loaded.state.users[0],
          {
            role: nextMembership.role,
            provider:
              loaded.state.ssoProviders.find(
                (item) => item.organizationId === organizationId,
              ) ?? null,
          },
        ),
      });

      persistControlState(safeStorage, nextControl);
      const tenant = ensureTenantState(safeStorage, nextControl, builtInScenarios);

      const workspace = buildWorkspaceView(
        {
          state: combineBackendState(nextControl, tenant),
          initialLoadError: loaded.initialLoadError,
        },
        tenant.preferences.activeScenarioId,
      );
      recordBackendLatencySample({
        scope: "workspace",
        name: "workspace.switch_organization",
        startedAt,
        details: {
          organizationId,
          userId: nextUserId,
          role: nextMembership.role,
        },
      });
      return workspace;
    },
    setMotionMode(motionMode) {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();

      const nextState: ScenarioBackendState = {
        ...loaded.state,
        preferences: {
          ...loaded.state.preferences,
          motionMode,
        },
      };

      const workspace = persistAndBuild(nextState, loaded.initialLoadError);
      recordBackendLatencySample({
        scope: "workspace",
        name: "workspace.set_motion_mode",
        startedAt,
        details: {
          motionMode,
        },
      });
      return workspace;
    },
    async runSecurityVerification() {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();
      const { buildOwaspAsvsVerificationRun } = await import(
        "@/lib/securityVerification"
      );
      const run = buildOwaspAsvsVerificationRun({
        state: loaded.state,
        tenantStorageKey: getScenarioBackendTenantStorageKey(
          loaded.state.currentOrganizationId,
        ),
      });

      const nextState: ScenarioBackendState = {
        ...loaded.state,
        securityVerifications: trimSecurityVerifications([
          run,
          ...loaded.state.securityVerifications,
        ]),
      };

      const workspace = persistAndBuild(nextState, loaded.initialLoadError);
      recordBackendLatencySample({
        scope: "security",
        name: "security.run_verification",
        startedAt,
        details: {
          overallStatus: run.overallStatus,
          passCount: run.passCount,
          warnCount: run.warnCount,
          failCount: run.failCount,
        },
      });
      return workspace;
    },
    saveScenario(scenario, source, options) {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();
      const nextState = upsertScenarioState(loaded.state, scenario, source, options);
      const workspace = persistAndBuild(nextState, loaded.initialLoadError);
      recordBackendLatencySample({
        scope: "scenario",
        name: "scenario.save",
        startedAt,
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        details: {
          source,
          recordVersion: options?.recordVersion ?? source !== "edit",
          recordAudit: options?.recordAudit ?? true,
        },
      });
      return workspace;
    },
    selectScenario(scenarioId, options) {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();
      if (!loaded.state.scenarios.some((record) => record.id === scenarioId)) {
        return buildWorkspaceView(loaded);
      }

      const recordAudit = options?.recordAudit ?? true;
      const version = resolveVersionForSnapshot(loaded.state, scenarioId);
      const nextState: ScenarioBackendState = {
        ...loaded.state,
        preferences: {
          ...loaded.state.preferences,
          activeScenarioId: scenarioId,
        },
        auditEvents: recordAudit
          ? appendAuditEvent(
              loaded.state.auditEvents,
              createAuditEvent(
                loaded.state,
                scenarioId,
                "scenario.selected",
                `Selected scenario ${version?.scenario.name ?? scenarioId}`,
                {
                  scenarioName: version?.scenario.name ?? scenarioId,
                  revision: version?.revision ?? null,
                },
              ),
            )
          : loaded.state.auditEvents,
      };

      const workspace = persistAndBuild(nextState, loaded.initialLoadError);
      recordBackendLatencySample({
        scope: "workspace",
        name: "workspace.select_scenario",
        startedAt,
        scenarioId,
        scenarioName: version?.scenario.name ?? scenarioId,
        details: {
          recordAudit,
        },
      });
      return workspace;
    },
    deleteScenario(scenarioId) {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();
      const membership = loaded.state.memberships.find(
        (item) =>
          item.organizationId === loaded.state.currentOrganizationId &&
          item.userId === loaded.state.currentUserId,
      );
      if (!membership) {
        recordBackendLatencySample({
          scope: "scenario",
          name: "scenario.delete",
          startedAt,
          status: "error",
          scenarioId,
          details: {
            reason: "membership_not_found",
          },
        });
        throw new Error("Active membership was not found for the current user.");
      }
      assertScenarioPermission(
        membership.role,
        "scenario.delete",
        `Your ${membership.role} role cannot delete scenarios.`,
      );

      const record = loaded.state.scenarios.find((item) => item.id === scenarioId);
      if (!record || record.origin !== "custom") {
        return buildWorkspaceView(loaded);
      }

      const version = resolveVersionForSnapshot(loaded.state, scenarioId);
      const nextState: ScenarioBackendState = {
        ...loaded.state,
        scenarios: loaded.state.scenarios.filter((item) => item.id !== scenarioId),
        scenarioVersions: loaded.state.scenarioVersions.filter(
          (item) => item.scenarioId !== scenarioId,
        ),
        replaySnapshots: loaded.state.replaySnapshots.filter(
          (item) => item.scenarioId !== scenarioId,
        ),
        auditEvents: appendAuditEvent(
          loaded.state.auditEvents,
          createAuditEvent(
            loaded.state,
            scenarioId,
            "scenario.deleted",
            `Deleted scenario ${version?.scenario.name ?? scenarioId}`,
            {
              scenarioName: version?.scenario.name ?? scenarioId,
              revision: version?.revision ?? null,
            },
          ),
        ),
        preferences: {
          ...loaded.state.preferences,
          activeScenarioId:
            loaded.state.preferences.activeScenarioId === scenarioId
              ? null
              : loaded.state.preferences.activeScenarioId,
        },
      };

      const workspace = persistAndBuild(nextState, loaded.initialLoadError);
      recordBackendLatencySample({
        scope: "scenario",
        name: "scenario.delete",
        startedAt,
        scenarioId,
        scenarioName: version?.scenario.name ?? scenarioId,
        details: {
          role: membership.role,
        },
      });
      return workspace;
    },
    publishScenarioRevision(scenarioId, revision) {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();
      const membership = loaded.state.memberships.find(
        (item) =>
          item.organizationId === loaded.state.currentOrganizationId &&
          item.userId === loaded.state.currentUserId,
      );
      if (!membership) {
        recordBackendLatencySample({
          scope: "scenario",
          name: "scenario.publish",
          startedAt,
          status: "error",
          scenarioId,
          details: {
            revision,
            reason: "membership_not_found",
          },
        });
        throw new Error("Active membership was not found for the current user.");
      }
      assertScenarioPermission(
        membership.role,
        "scenario.publish",
        `Your ${membership.role} role cannot publish scenarios.`,
      );

      const record = loaded.state.scenarios.find(
        (item) => item.id === scenarioId && item.origin === "custom",
      );
      const version = loaded.state.scenarioVersions.find(
        (item) => item.scenarioId === scenarioId && item.revision === revision,
      );

      if (!record || !version) {
        return buildWorkspaceView(loaded);
      }

      const nextState: ScenarioBackendState = {
        ...loaded.state,
        scenarios: loaded.state.scenarios.map((item) =>
          item.id === scenarioId
            ? {
                ...item,
                publishedVersionId: version.id,
                status: "published",
                updatedAt: resolveNow(),
                updatedByUserId: loaded.state.currentUserId,
              }
            : item,
        ),
        auditEvents: appendAuditEvent(
          loaded.state.auditEvents,
          createAuditEvent(
            loaded.state,
            scenarioId,
            "scenario.published",
            `Published revision ${revision} of ${version.scenario.name}`,
            {
              scenarioName: version.scenario.name,
              revision,
              source: version.source,
            },
          ),
        ),
      };

      const workspace = persistAndBuild(nextState, loaded.initialLoadError);
      recordBackendLatencySample({
        scope: "scenario",
        name: "scenario.publish",
        startedAt,
        scenarioId,
        scenarioName: version.scenario.name,
        details: {
          revision,
          role: membership.role,
        },
      });
      return workspace;
    },
    markScenarioExported(scenarioId, scenarioName, revision) {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();
      const membership = loaded.state.memberships.find(
        (item) =>
          item.organizationId === loaded.state.currentOrganizationId &&
          item.userId === loaded.state.currentUserId,
      );
      if (!membership) {
        recordBackendLatencySample({
          scope: "scenario",
          name: "scenario.mark_exported",
          startedAt,
          status: "error",
          scenarioId,
          scenarioName,
          details: {
            revision,
            reason: "membership_not_found",
          },
        });
        throw new Error("Active membership was not found for the current user.");
      }
      assertScenarioPermission(
        membership.role,
        "scenario.export",
        `Your ${membership.role} role cannot export scenarios.`,
      );

      const nextState: ScenarioBackendState = {
        ...loaded.state,
        auditEvents: appendAuditEvent(
          loaded.state.auditEvents,
          createAuditEvent(
            loaded.state,
            scenarioId,
            "scenario.exported",
            `Exported scenario ${scenarioName}`,
            {
              scenarioName,
              revision: revision ?? null,
              trigger: "export",
            },
          ),
        ),
      };

      const workspace = persistAndBuild(nextState, loaded.initialLoadError);
      recordBackendLatencySample({
        scope: "scenario",
        name: "scenario.mark_exported",
        startedAt,
        scenarioId,
        scenarioName,
        details: {
          revision,
          role: membership.role,
        },
      });
      return workspace;
    },
    captureReplaySnapshot(input) {
      const startedAt = getDurationStart();
      const loaded = readLoadedState();
      const membership = loaded.state.memberships.find(
        (item) =>
          item.organizationId === loaded.state.currentOrganizationId &&
          item.userId === loaded.state.currentUserId,
      );
      if (!membership) {
        recordBackendLatencySample({
          scope: "replay",
          name: "replay.capture_snapshot",
          startedAt,
          status: "error",
          scenarioId: input.scenarioId,
          details: {
            trigger: input.trigger,
            reason: "membership_not_found",
          },
        });
        throw new Error("Active membership was not found for the current user.");
      }
      const snapshotPermission =
        input.trigger === "export"
          ? "scenario.export"
          : input.trigger === "share"
            ? "scenario.share"
            : "scenario.view";
      assertScenarioPermission(
        membership.role,
        snapshotPermission,
        `Your ${membership.role} role cannot ${snapshotPermission.replace("scenario.", "")} scenarios.`,
      );

      const version = resolveVersionForSnapshot(
        loaded.state,
        input.scenarioId,
        input.revision,
      );

      if (!version) {
        return buildWorkspaceView(loaded);
      }

      const nextState: ScenarioBackendState = {
        ...loaded.state,
        replaySnapshots: trimReplaySnapshots([
          {
            id: createId("backend-replay-snapshot"),
            organizationId: loaded.state.currentOrganizationId,
            scenarioId: input.scenarioId,
            scenarioVersionId: version.id,
            trigger: input.trigger,
            currentTime: input.currentTime,
            activeEventIds: input.activeEventIds,
            nodeStates: toNodeStatesRecord(input.nodeStates),
            createdAt: resolveNow(),
          },
          ...loaded.state.replaySnapshots,
        ]),
        auditEvents: appendAuditEvent(
          loaded.state.auditEvents,
          createAuditEvent(
            loaded.state,
            input.scenarioId,
            input.trigger === "playback"
              ? "replay.playback.completed"
              : "replay.snapshot.captured",
            input.trigger === "playback"
              ? `Completed playback of ${version.scenario.name} at ${formatSeconds(
                  input.currentTime,
                )}`
              : `Captured ${input.trigger} snapshot for ${version.scenario.name} at ${formatSeconds(
                  input.currentTime,
                )}`,
            {
              scenarioName: version.scenario.name,
              revision: version.revision,
              source: version.source,
              trigger: input.trigger,
              currentTime: input.currentTime,
              activeEventCount: input.activeEventIds.length,
            },
          ),
        ),
      };

      const workspace = persistAndBuild(nextState, loaded.initialLoadError);
      recordBackendLatencySample({
        scope: "replay",
        name: "replay.capture_snapshot",
        startedAt,
        scenarioId: input.scenarioId,
        scenarioName: version.scenario.name,
        details: {
          trigger: input.trigger,
          revision: version.revision,
          currentTime: input.currentTime,
          activeEventCount: input.activeEventIds.length,
        },
      });
      return workspace;
    },
  };
}
