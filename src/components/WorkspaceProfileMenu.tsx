import React from "react";
import {
  Building2,
  ChevronsUpDown,
  KeyRound,
  ShieldCheck,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { type MotionMode } from "@/lib/motionPreferences";
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

const LazyWorkspaceAccessDialog = React.lazy(async () => {
  const module = await import("@/components/WorkspaceAccessDialog");

  return { default: module.WorkspaceAccessDialog };
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

function SummaryPill({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
      <Icon className="h-3 w-3" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function MenuRow({
  icon: Icon,
  title,
  meta,
  metaTone = "default",
}: {
  icon: LucideIcon;
  title: string;
  meta?: string;
  metaTone?: "default" | "attention";
}) {
  return (
    <>
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {title}
      </span>
      {meta ? (
        <span
          className={cn(
            "max-w-32 shrink-0 truncate rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em]",
            metaTone === "attention"
              ? "border-severity-high/30 bg-severity-high/10 text-severity-high"
              : "border-border/60 bg-background/80 text-muted-foreground",
          )}
        >
          {meta}
        </span>
      ) : null}
    </>
  );
}

function formatSecurityVerificationMeta(
  latestSecurityVerification: ScenarioBackendSecurityVerificationRun | null,
) {
  if (!latestSecurityVerification) {
    return "Run check";
  }

  return latestSecurityVerification.overallStatus === "pass"
    ? "Verified"
    : latestSecurityVerification.overallStatus === "warn"
      ? "Review"
      : "Action";
}

export function WorkspaceProfileMenu({
  organizationId,
  organizationName,
  viewer,
  role,
  authSession,
  activeSsoProvider,
  ssoConnections,
  availableAccessProfiles,
  permissions,
  securityVerifications,
  storageStrategy,
  onSignInWithOidc,
  onSignInAsUser,
  onRunSecurityVerification,
}: WorkspaceProfileMenuProps) {
  const [isAccessDialogOpen, setIsAccessDialogOpen] = React.useState(false);
  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = React.useState(false);
  const latestSecurityVerification = securityVerifications[0] ?? null;
  const permissionsSummary = `${permissions.length} grant${permissions.length === 1 ? "" : "s"}`;

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
          className="w-[22rem] overflow-hidden border-border/60 bg-background/95 p-0 shadow-2xl backdrop-blur-xl"
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
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <SummaryPill icon={Building2} label={organizationName} />
                  <SummaryPill
                    icon={KeyRound}
                    label={authSession.method === "oidc" ? "SSO session" : "Local session"}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-2">
            <DropdownMenuLabel className="px-2 pb-1 pt-2 font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Controls
            </DropdownMenuLabel>

            <DropdownMenuItem
              className="rounded-xl px-2.5 py-2.5"
              onSelect={() => setIsAccessDialogOpen(true)}
            >
              <MenuRow
                icon={ShieldCheck}
                title="Role & permissions"
                meta={permissionsSummary}
              />
            </DropdownMenuItem>

            <DropdownMenuItem
              className="rounded-xl px-2.5 py-2.5"
              onSelect={() => setIsSecurityDialogOpen(true)}
            >
              <MenuRow
                icon={Shield}
                title="Security verification"
                meta={formatSecurityVerificationMeta(latestSecurityVerification)}
                metaTone={
                  latestSecurityVerification?.overallStatus === "fail"
                    ? "attention"
                    : "default"
                }
              />
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
            permissions={permissions}
            availableAccessProfiles={availableAccessProfiles}
            onSignInAsUser={onSignInAsUser}
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
    </>
  );
}
