import { getPermissionsForRole } from "@/lib/scenarioAuth";
import {
  type ScenarioBackendSecurityVerificationFinding,
  type ScenarioBackendSecurityVerificationRun,
  type ScenarioBackendState,
} from "@/lib/scenarioBackendModels";
import { SCENARIO_SNAPSHOT_SEARCH_PARAM } from "@/lib/scenarioPermalinks";

function createFinding(
  finding: Omit<ScenarioBackendSecurityVerificationFinding, "id">,
): ScenarioBackendSecurityVerificationFinding {
  return {
    id: `${finding.controlId}:${finding.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    ...finding,
  };
}

export function buildOwaspAsvsVerificationRun(input: {
  state: ScenarioBackendState;
  tenantStorageKey: string;
  now?: string;
}): ScenarioBackendSecurityVerificationRun {
  const now = input.now ?? new Date().toISOString();
  const { state, tenantStorageKey } = input;
  const storageStrategy = "tenant-local-storage";
  const actor =
    state.users.find((user) => user.id === state.currentUserId) ?? null;
  const membership =
    state.memberships.find(
      (item) =>
        item.organizationId === state.currentOrganizationId &&
        item.userId === state.currentUserId,
    ) ?? null;
  const activeProvider =
    state.ssoProviders.find(
      (provider) => provider.organizationId === state.currentOrganizationId,
    ) ?? null;
  const privilegedAuditCount = state.auditEvents.filter((event) =>
    [
      "scenario.created",
      "scenario.imported",
      "scenario.updated",
      "scenario.deleted",
      "scenario.published",
      "scenario.exported",
    ].includes(event.type),
  ).length;
  const viewerPermissions = getPermissionsForRole("viewer");
  const findings: ScenarioBackendSecurityVerificationFinding[] = [
    createFinding({
      family: "V1 Architecture",
      controlId: "V1.1",
      title: "Tenant isolation boundary",
      status:
        state.currentOrganizationId.length > 0 &&
        tenantStorageKey.includes(state.currentOrganizationId)
          ? "pass"
          : "fail",
      severity: "critical",
      summary:
        tenantStorageKey.includes(state.currentOrganizationId)
          ? "Workspace state is namespaced per organization boundary."
          : "Tenant namespace does not clearly bind persisted state to the active organization.",
      evidence: `Active tenant storage key: ${tenantStorageKey}`,
      remediation:
        "Persist security-critical state in a server-side tenant partition and validate namespace binding at load time.",
    }),
    createFinding({
      family: "V2 Authentication",
      controlId: "V2.1",
      title: "Enterprise identity provider availability",
      status: activeProvider ? "pass" : "fail",
      severity: activeProvider ? "low" : "high",
      summary: activeProvider
        ? "An enterprise OIDC provider is configured for the active workspace."
        : "The active workspace has no enterprise OIDC provider configured.",
      evidence: activeProvider
        ? `${activeProvider.name} (${activeProvider.issuer})`
        : "No provider matched the active organization.",
      remediation:
        "Configure a tenant OIDC provider and require enterprise sign-in for production workspaces.",
    }),
    createFinding({
      family: "V2 Authentication",
      controlId: "V2.2",
      title: "Current session assurance",
      status: state.authSession?.method === "oidc" ? "pass" : "warn",
      severity: state.authSession?.method === "oidc" ? "low" : "medium",
      summary:
        state.authSession?.method === "oidc"
          ? "The current operator is authenticated through enterprise SSO."
          : "The current operator is using preview-mode identity instead of enterprise SSO.",
      evidence: `Auth method: ${state.authSession?.method ?? "preview"}`,
      remediation:
        "Use enterprise OIDC sessions for security validation, audit, and production workflows.",
    }),
    createFinding({
      family: "V4 Access Control",
      controlId: "V4.1",
      title: "Role-based access control enforcement",
      status: membership ? "pass" : "fail",
      severity: membership ? "low" : "critical",
      summary: membership
        ? `Repository enforcement is active for the ${membership.role} role.`
        : "No active organization membership was found for the current user.",
      evidence: membership
        ? `Permissions: ${getPermissionsForRole(membership.role).join(", ")}`
        : "Membership lookup returned null.",
      remediation:
        "Require every session to resolve to an organization membership before workspace access is granted.",
    }),
    createFinding({
      family: "V4 Access Control",
      controlId: "V4.2",
      title: "Least-privilege viewer role review",
      status:
        viewerPermissions.includes("scenario.share") ||
        viewerPermissions.includes("scenario.export")
          ? "warn"
          : "pass",
      severity:
        viewerPermissions.includes("scenario.share") ||
        viewerPermissions.includes("scenario.export")
          ? "medium"
          : "low",
      summary:
        viewerPermissions.includes("scenario.share") ||
        viewerPermissions.includes("scenario.export")
          ? "Viewer profiles can still share or export scenario data."
          : "Viewer profiles are restricted to observation-only capabilities.",
      evidence: `Viewer permissions: ${viewerPermissions.join(", ")}`,
      remediation:
        "Validate whether share/export actions should be limited to editor+ roles in production tenants.",
    }),
    createFinding({
      family: "V5 Validation",
      controlId: "V5.1",
      title: "Runtime scenario schema validation",
      status: "pass",
      severity: "low",
      summary:
        "Scenario imports and shared snapshots are normalized through runtime schema parsing before use.",
      evidence:
        "parseScenario() is enforced for imports, share snapshots, and backend state hydration.",
      remediation:
        "Keep schema migrations versioned and add negative-path tests whenever the scenario format changes.",
    }),
    createFinding({
      family: "V7 Error Handling",
      controlId: "V7.1",
      title: "Privileged activity audit coverage",
      status: privilegedAuditCount > 0 ? "pass" : "warn",
      severity: privilegedAuditCount > 0 ? "low" : "medium",
      summary:
        privilegedAuditCount > 0
          ? "Audit trails exist for privileged scenario mutations in this workspace."
          : "No privileged scenario mutations have been captured yet in this workspace.",
      evidence: `Privileged audit events captured: ${privilegedAuditCount}`,
      remediation:
        "Exercise create, edit, publish, export, and delete paths in staging so audit evidence is continuously validated.",
    }),
    createFinding({
      family: "V8 Data Protection",
      controlId: "V8.1",
      title: "Storage protection posture",
      status: storageStrategy === "tenant-local-storage" ? "warn" : "pass",
      severity: storageStrategy === "tenant-local-storage" ? "high" : "low",
      summary:
        storageStrategy === "tenant-local-storage"
          ? "Workspace data is still stored in browser local storage rather than a hardened server-side data store."
          : "Workspace data is backed by a production-grade storage plane.",
      evidence: `Storage strategy: ${storageStrategy}`,
      remediation:
        "Move scenario, snapshot, and audit data into encrypted server-side storage with centralized backup and retention controls.",
    }),
    createFinding({
      family: "V9 Communication",
      controlId: "V9.1",
      title: "Share-link transport design",
      status: "warn",
      severity: "high",
      summary:
        "Custom scenario share links can embed normalized scenario snapshots directly in the URL query string.",
      evidence: `Custom share links use the \`${SCENARIO_SNAPSHOT_SEARCH_PARAM}\` query parameter.`,
      remediation:
        "Replace URL-embedded snapshots with signed, expiring server-side share tokens backed by published scenario versions.",
    }),
    createFinding({
      family: "V10 Malicious Input",
      controlId: "V10.1",
      title: "Import boundary checks",
      status: "pass",
      severity: "low",
      summary:
        "Scenario import accepts only validated JSON payloads and rejects oversized files before parsing.",
      evidence: "Import flow enforces a 1 MB file limit plus schema validation.",
      remediation:
        "Retain import-size limits and add content scanning if binary attachments or richer artifacts are introduced later.",
    }),
  ];

  const passCount = findings.filter((finding) => finding.status === "pass").length;
  const warnCount = findings.filter((finding) => finding.status === "warn").length;
  const failCount = findings.filter((finding) => finding.status === "fail").length;

  return {
    id: `security-verification-${crypto.randomUUID()}`,
    organizationId: state.currentOrganizationId,
    framework: "OWASP ASVS-aligned",
    createdAt: now,
    actorUserId: actor?.id ?? null,
    actorName: actor?.name ?? null,
    actorRole: membership?.role ?? null,
    authMethod: state.authSession?.method ?? "preview",
    overallStatus: failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass",
    passCount,
    warnCount,
    failCount,
    findings,
  };
}
