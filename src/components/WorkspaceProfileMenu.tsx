import React from "react";
import {
  ActivitySquare,
  Building2,
  ChevronsUpDown,
  KeyRound,
  ShieldCheck,
  Shield,
  SlidersHorizontal,
  UserCog,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  getMembershipRoleLabel,
  type ScenarioWorkspacePermission,
} from "@/lib/scenarioAuth";
import type {
  OrganizationMembershipRole,
  ScenarioBackendAuthSession,
  ScenarioBackendMembership,
  ScenarioBackendOidcProvider,
  ScenarioBackendOrganization,
  ScenarioBackendSecurityVerificationRun,
  ScenarioBackendSystemLog,
  ScenarioBackendTelemetrySample,
  ScenarioBackendUser,
} from "@/lib/scenarioBackendModels";
import {
  motionModeDescriptions,
  motionModeLabels,
  motionModeValues,
  type MotionMode,
} from "@/lib/motionPreferences";
import { cn } from "@/lib/utils";

interface AccessProfile {
  user: ScenarioBackendUser;
  membership: ScenarioBackendMembership;
}

interface WorkspaceOrganizationOption {
  organization: {
    id: string;
    name: string;
  };
  membership: ScenarioBackendMembership;
  storageKey: string;
}

const LazyEnterpriseSsoDialog = React.lazy(async () => {
  const module = await import("@/components/EnterpriseSsoDialog");

  return { default: module.EnterpriseSsoDialog };
});

const LazyWorkspaceAccessDialog = React.lazy(async () => {
  const module = await import("@/components/WorkspaceAccessDialog");

  return { default: module.WorkspaceAccessDialog };
});

const LazySystemObservabilityDialog = React.lazy(async () => {
  const module = await import("@/components/SystemObservabilityDialog");

  return { default: module.SystemObservabilityDialog };
});

const LazySecurityVerificationDialog = React.lazy(async () => {
  const module = await import("@/components/SecurityVerificationDialog");

  return { default: module.SecurityVerificationDialog };
});

interface WorkspaceProfileMenuProps {
  organizationId: string;
  organizationName: string;
  viewer: ScenarioBackendUser;
  role: OrganizationMembershipRole;
  authSession: ScenarioBackendAuthSession;
  activeSsoProvider: ScenarioBackendOidcProvider | null;
  ssoConnections: Array<{
    organization: ScenarioBackendOrganization;
    provider: ScenarioBackendOidcProvider;
    profiles: AccessProfile[];
  }>;
  availableOrganizations: WorkspaceOrganizationOption[];
  availableAccessProfiles: AccessProfile[];
  permissions: ScenarioWorkspacePermission[];
  securityVerifications: ScenarioBackendSecurityVerificationRun[];
  systemLogs: ScenarioBackendSystemLog[];
  telemetrySamples: ScenarioBackendTelemetrySample[];
  storageStrategy: {
    kind: "tenant-local-storage";
    controlPlaneKey: string;
    tenantStorageKey: string;
    isolationBoundary: "organization";
  };
  motionMode: MotionMode;
  onSignInWithOidc: (providerId: string, userId: string) => void;
  onSignInAsUser: (userId: string) => void;
  onSetMotionMode: (motionMode: MotionMode) => void;
  onRunSecurityVerification: () => Promise<void> | void;
  onSwitchOrganization: (organizationId: string) => void;
}

const roleBadgeClasses: Record<OrganizationMembershipRole, string> = {
  owner: "bg-primary/15 text-primary border-primary/30",
  admin: "bg-severity-high/15 text-severity-high border-severity-high/30",
  editor: "bg-severity-info/15 text-severity-info border-severity-info/30",
  viewer: "bg-secondary text-muted-foreground border-border/50",
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("");
}

function ProfileAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("border border-primary/20 shadow-sm", className)}>
      <AvatarFallback className="bg-gradient-to-br from-blue-500/20 via-cyan-500/15 to-emerald-500/10 text-[11px] font-semibold text-foreground">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function WorkspaceProfileMenu({
  organizationId,
  organizationName,
  viewer,
  role,
  authSession,
  activeSsoProvider,
  ssoConnections,
  availableOrganizations,
  availableAccessProfiles,
  permissions,
  securityVerifications,
  systemLogs,
  telemetrySamples,
  storageStrategy,
  motionMode,
  onSignInWithOidc,
  onSignInAsUser,
  onSetMotionMode,
  onRunSecurityVerification,
  onSwitchOrganization,
}: WorkspaceProfileMenuProps) {
  const [isAccessDialogOpen, setIsAccessDialogOpen] = React.useState(false);
  const [isSsoDialogOpen, setIsSsoDialogOpen] = React.useState(false);
  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = React.useState(false);
  const [isObservabilityDialogOpen, setIsObservabilityDialogOpen] = React.useState(false);
  const errorLogCount = React.useMemo(
    () => systemLogs.filter((log) => log.level === "error").length,
    [systemLogs],
  );
  const latestSecurityVerification = securityVerifications[0] ?? null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto rounded-full border border-border/60 bg-background/70 px-1.5 py-1.5 shadow-sm transition-all hover:border-primary/30 hover:bg-accent/70"
            aria-label={`Open workspace profile menu for ${viewer.name}`}
          >
            <ProfileAvatar name={viewer.name} className="h-8 w-8" />
            <div className="hidden min-w-0 text-left sm:block">
              <p className="max-w-32 truncate text-xs font-medium text-foreground">
                {viewer.name}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {getMembershipRoleLabel(role)}
              </p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-80 overflow-hidden border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl"
        >
          <div className="border-b border-border/50 bg-gradient-to-br from-blue-500/10 via-background to-cyan-500/10 p-3">
            <div className="flex items-start gap-3">
              <ProfileAvatar name={viewer.name} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {viewer.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {viewer.email}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                      roleBadgeClasses[role],
                    )}
                  >
                    {getMembershipRoleLabel(role)}
                  </span>
                </div>
                <div className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {organizationName}
                </div>
              </div>
            </div>
          </div>

          <div className="p-2">
            <DropdownMenuLabel className="px-2 pb-1 pt-1 font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Workspace Access
            </DropdownMenuLabel>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="rounded-md px-2 py-2">
                <Building2 className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">Switch workspace</span>
                  <span className="text-xs text-muted-foreground">
                    Change organization and keep each tenant isolated.
                  </span>
                </div>
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent className="w-80 border-border/60 bg-background/95 p-1 shadow-2xl">
                <DropdownMenuLabel className="px-2 py-2 text-xs">
                  Operate inside
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={organizationId}
                  onValueChange={onSwitchOrganization}
                >
                  {availableOrganizations.map((workspace) => (
                    <DropdownMenuRadioItem
                      key={workspace.organization.id}
                      value={workspace.organization.id}
                      className="items-start rounded-md py-2 pl-8 pr-3"
                    >
                      <div className="flex w-full items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {workspace.organization.name}
                          </p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">
                            {workspace.storageKey}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                            roleBadgeClasses[workspace.membership.role],
                          )}
                        >
                          {getMembershipRoleLabel(workspace.membership.role)}
                        </span>
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="rounded-md px-2 py-2">
                <UserCog className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">Preview profile</span>
                  <span className="text-xs text-muted-foreground">
                    Test RBAC locally without minting an OIDC session.
                  </span>
                </div>
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent className="w-80 border-border/60 bg-background/95 p-1 shadow-2xl">
                <DropdownMenuLabel className="px-2 py-2 text-xs">
                  Operate as
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={viewer.id}
                  onValueChange={onSignInAsUser}
                >
                  {availableAccessProfiles.map((profile) => (
                    <DropdownMenuRadioItem
                      key={profile.user.id}
                      value={profile.user.id}
                      className="items-start rounded-md py-2 pl-8 pr-3"
                    >
                      <div className="flex w-full items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {profile.user.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {profile.user.email}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                            roleBadgeClasses[profile.membership.role],
                          )}
                        >
                          {getMembershipRoleLabel(profile.membership.role)}
                        </span>
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="rounded-md px-2 py-2">
                <SlidersHorizontal className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">Motion & animation</span>
                  <span className="text-xs text-muted-foreground">
                    {motionModeLabels[motionMode]} active for this workspace.
                  </span>
                </div>
              </DropdownMenuSubTrigger>

              <DropdownMenuSubContent className="w-80 border-border/60 bg-background/95 p-1 shadow-2xl">
                <DropdownMenuLabel className="px-2 py-2 text-xs">
                  Simulator motion
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={motionMode}
                  onValueChange={(value) => onSetMotionMode(value as MotionMode)}
                >
                  {motionModeValues.map((mode) => (
                    <DropdownMenuRadioItem
                      key={mode}
                      value={mode}
                      className="items-start rounded-md py-2 pl-8 pr-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {motionModeLabels[mode]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {motionModeDescriptions[mode]}
                        </p>
                      </div>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="rounded-md px-2 py-2"
              onSelect={() => setIsSsoDialogOpen(true)}
            >
              <KeyRound className="mr-2 h-4 w-4 text-primary" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">Enterprise SSO</span>
                <span className="text-xs text-muted-foreground">
                  {authSession.method === "oidc"
                    ? `${authSession.providerName ?? "OIDC"} session is active.`
                    : "Connect through a tenant OIDC provider."}
                </span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="rounded-md px-2 py-2"
              onSelect={() => setIsAccessDialogOpen(true)}
            >
              <ShieldCheck className="mr-2 h-4 w-4 text-primary" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">Access & permissions</span>
                <span className="text-xs text-muted-foreground">
                  {permissions.length} active grants in this workspace.
                </span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="rounded-md px-2 py-2"
              onSelect={() => setIsSecurityDialogOpen(true)}
            >
              <Shield className="mr-2 h-4 w-4 text-primary" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">Security verification</span>
                <span className="text-xs text-muted-foreground">
                  {latestSecurityVerification
                    ? `${latestSecurityVerification.framework} report is ${latestSecurityVerification.overallStatus}.`
                    : "Run an OWASP ASVS-aligned verification for this workspace."}
                </span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              className="rounded-md px-2 py-2"
              onSelect={() => setIsObservabilityDialogOpen(true)}
            >
              <ActivitySquare className="mr-2 h-4 w-4 text-primary" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium">System logs & errors</span>
                <span className="text-xs text-muted-foreground">
                  {errorLogCount > 0
                    ? `${errorLogCount} logged errors need review.`
                    : `${systemLogs.length} structured events captured.`}
                </span>
              </div>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {isAccessDialogOpen ? (
        <React.Suspense fallback={null}>
          <LazyWorkspaceAccessDialog
            open={isAccessDialogOpen}
            onOpenChange={setIsAccessDialogOpen}
            organizationName={organizationName}
            viewer={viewer}
            role={role}
            authSession={authSession}
            permissions={permissions}
            availableAccessProfiles={availableAccessProfiles}
            storageStrategy={storageStrategy}
            onSignInAsUser={onSignInAsUser}
          />
        </React.Suspense>
      ) : null}

      {isSsoDialogOpen ? (
        <React.Suspense fallback={null}>
          <LazyEnterpriseSsoDialog
            open={isSsoDialogOpen}
            onOpenChange={setIsSsoDialogOpen}
            currentOrganizationId={organizationId}
            authSession={authSession}
            activeSsoProvider={activeSsoProvider}
            ssoConnections={ssoConnections}
            onSignInWithOidc={onSignInWithOidc}
            onUsePreviewProfile={onSignInAsUser}
          />
        </React.Suspense>
      ) : null}

      {isSecurityDialogOpen ? (
        <React.Suspense fallback={null}>
          <LazySecurityVerificationDialog
            open={isSecurityDialogOpen}
            onOpenChange={setIsSecurityDialogOpen}
            organizationName={organizationName}
            authSession={authSession}
            verificationRuns={securityVerifications}
            onRunVerification={onRunSecurityVerification}
          />
        </React.Suspense>
      ) : null}

      {isObservabilityDialogOpen ? (
        <React.Suspense fallback={null}>
          <LazySystemObservabilityDialog
            logs={systemLogs}
            telemetrySamples={telemetrySamples}
            open={isObservabilityDialogOpen}
            onOpenChange={setIsObservabilityDialogOpen}
          />
        </React.Suspense>
      ) : null}
    </>
  );
}
