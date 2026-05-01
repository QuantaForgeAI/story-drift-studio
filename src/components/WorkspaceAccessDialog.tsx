import { Building2, ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getMembershipRoleLabel,
  scenarioPermissionLabels,
  type ScenarioWorkspacePermission,
} from "@/lib/scenarioAuth";
import type {
  OrganizationMembershipRole,
  ScenarioBackendMembership,
  ScenarioBackendUser,
} from "@/lib/scenarioBackendModels";
import { cn } from "@/lib/utils";

interface AccessProfile {
  user: ScenarioBackendUser;
  membership: ScenarioBackendMembership;
}

interface WorkspaceAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName: string;
  viewer: ScenarioBackendUser;
  role: OrganizationMembershipRole;
  permissions: ScenarioWorkspacePermission[];
  availableAccessProfiles: AccessProfile[];
  onSignInAsUser: (userId: string) => void;
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

export function WorkspaceAccessDialog({
  open,
  onOpenChange,
  organizationName,
  viewer,
  role,
  permissions,
  availableAccessProfiles,
  onSignInAsUser,
}: WorkspaceAccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden border-border/60 bg-background/95 p-0 shadow-2xl">
        <div className="border-b border-border/50 bg-gradient-to-br from-blue-500/10 via-background to-cyan-500/10 p-6">
          <DialogHeader className="text-left">
            <DialogTitle>Workspace access</DialogTitle>
          </DialogHeader>

          <div className="mt-4 flex items-start gap-4">
            <ProfileAvatar name={viewer.name} className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {viewer.name}
                </h3>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                    roleBadgeClasses[role],
                  )}
                >
                  {getMembershipRoleLabel(role)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{viewer.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {organizationName}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {permissions.length} active permissions
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section>
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-foreground">
                Permissions
              </h4>
            </div>

            <div className="flex flex-wrap gap-2">
              {permissions.map((permission) => (
                <span
                  key={permission}
                  className="rounded-full border border-border/60 bg-secondary/20 px-3 py-1.5 text-sm text-foreground"
                >
                  {scenarioPermissionLabels[permission]}
                </span>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-foreground">
                Preview roles
              </h4>
            </div>

            <div className="space-y-2">
              {availableAccessProfiles.map((profile) => {
                const isActive = profile.user.id === viewer.id;

                return (
                  <button
                    key={profile.user.id}
                    type="button"
                    onClick={() => onSignInAsUser(profile.user.id)}
                    aria-pressed={isActive}
                    aria-label={`Switch access profile to ${profile.user.name}, ${getMembershipRoleLabel(profile.membership.role)}`}
                    className={cn(
                      "focus-ring w-full rounded-xl border p-3 text-left transition-colors",
                      isActive
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/50 bg-secondary/20 hover:border-primary/20 hover:bg-accent/40",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <ProfileAvatar
                        name={profile.user.name}
                        className="h-10 w-10"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {profile.user.name}
                          </p>
                          {isActive ? (
                            <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
                              Active
                            </span>
                          ) : null}
                        </div>
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
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
