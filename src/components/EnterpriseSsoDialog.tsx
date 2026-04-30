import {
  BadgeCheck,
  Building2,
  Fingerprint,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ScenarioBackendAuthSession,
  ScenarioBackendMembership,
  ScenarioBackendOidcProvider,
  ScenarioBackendOrganization,
  ScenarioBackendUser,
} from "@/lib/scenarioBackendModels";
import { getMembershipRoleLabel } from "@/lib/scenarioAuth";
import { cn } from "@/lib/utils";

interface SsoConnection {
  organization: ScenarioBackendOrganization;
  provider: ScenarioBackendOidcProvider;
  profiles: Array<{
    user: ScenarioBackendUser;
    membership: ScenarioBackendMembership;
  }>;
}

interface EnterpriseSsoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOrganizationId: string;
  authSession: ScenarioBackendAuthSession;
  activeSsoProvider: ScenarioBackendOidcProvider | null;
  ssoConnections: SsoConnection[];
  onSignInWithOidc: (providerId: string, userId: string) => void;
  onUsePreviewProfile: (userId: string) => void;
}

const sessionBadgeClasses: Record<ScenarioBackendAuthSession["method"], string> = {
  oidc: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  preview: "border-border/60 bg-secondary/50 text-muted-foreground",
};

const providerStatusClasses: Record<ScenarioBackendOidcProvider["status"], string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

function formatDateTime(value: string | null) {
  if (!value) return "Not set";

  return new Date(value).toLocaleString();
}

function getSessionMethodLabel(method: ScenarioBackendAuthSession["method"]) {
  return method === "oidc" ? "Enterprise SSO" : "Preview Mode";
}

function getProviderStatusLabel(status: ScenarioBackendOidcProvider["status"]) {
  return status === "active" ? "Healthy" : "Needs attention";
}

export function EnterpriseSsoDialog({
  open,
  onOpenChange,
  currentOrganizationId,
  authSession,
  activeSsoProvider,
  ssoConnections,
  onSignInWithOidc,
  onUsePreviewProfile,
}: EnterpriseSsoDialogProps) {
  const activeConnection =
    ssoConnections.find(
      (connection) => connection.organization.id === currentOrganizationId,
    ) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-hidden border-border/60 bg-background/95 p-0 shadow-2xl">
        <div className="border-b border-border/50 bg-gradient-to-br from-blue-500/10 via-background to-cyan-500/10 p-6">
          <DialogHeader className="text-left">
            <DialogTitle>Enterprise SSO</DialogTitle>
            <DialogDescription>
              Simulate OIDC-backed workforce sign-in per tenant while keeping
              local profile preview available for RBAC testing.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Current session
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-foreground">
                    {authSession.email}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {authSession.providerName ?? "Local preview session"}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
                    sessionBadgeClasses[authSession.method],
                  )}
                >
                  {getSessionMethodLabel(authSession.method)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                    Subject
                  </p>
                  <p className="mt-1 break-all text-foreground">
                    {authSession.subject ?? "Not issued in preview mode"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                    Last authenticated
                  </p>
                  <p className="mt-1 text-foreground">
                    {formatDateTime(authSession.lastAuthenticatedAt)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Active provider
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">
                    {activeSsoProvider?.name ?? "No provider selected"}
                  </h3>
                </div>
                {activeSsoProvider ? (
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
                      providerStatusClasses[activeSsoProvider.status],
                    )}
                  >
                    {getProviderStatusLabel(activeSsoProvider.status)}
                  </span>
                ) : null}
              </div>

              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <div className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {activeConnection?.organization.name ?? "Select a workspace"}
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  {activeSsoProvider?.issuer ?? "OIDC issuer unavailable"}
                </div>
                <div className="inline-flex items-center gap-1.5">
                  <Fingerprint className="h-3.5 w-3.5" />
                  Expires {formatDateTime(authSession.expiresAt)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs defaultValue="session" className="p-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="session">Session</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
          </TabsList>

          <TabsContent value="session" className="mt-5">
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Session claims
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Claims are simulated so we can exercise enterprise auth
                    flows without requiring a live identity provider in this repo.
                  </p>
                </div>

                <div className="grid gap-2">
                  {Object.entries(authSession.claims).map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-xl border border-border/50 bg-secondary/20 px-3 py-2"
                    >
                      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                        {key}
                      </p>
                      <p className="mt-1 break-all text-sm text-foreground">
                        {String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Session posture
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Preview mode is useful for design and QA, while enterprise
                    SSO reflects how a customer tenant would authenticate through
                    OIDC.
                  </p>
                </div>

                <div className="rounded-2xl border border-border/50 bg-background/60 p-4">
                  <div className="flex items-start gap-3">
                    {authSession.method === "oidc" ? (
                      <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-300" />
                    ) : (
                      <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-300" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {authSession.method === "oidc"
                          ? "OIDC session is active"
                          : "Using preview profile mode"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {authSession.method === "oidc"
                          ? "This workspace is running with provider-issued subject, issuer, audience, and claim context."
                          : "This bypasses the enterprise provider and is best reserved for role walkthroughs and local testing."}
                      </p>
                    </div>
                  </div>

                  {authSession.method === "oidc" ? (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => onUsePreviewProfile(authSession.userId)}
                    >
                      Use preview mode instead
                    </Button>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-dashed border-border/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
                  Keep `Preview profile` for RBAC exploration. Use `Enterprise SSO`
                  when you want the simulator to carry provider metadata,
                  issuer details, and OIDC claim context end-to-end.
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="providers" className="mt-5">
            <div className="grid gap-4 lg:grid-cols-2">
              {ssoConnections.map((connection) => {
                const isCurrentOrg =
                  connection.organization.id === currentOrganizationId;

                return (
                  <section
                    key={connection.provider.id}
                    className={cn(
                      "rounded-2xl border p-4",
                      isCurrentOrg
                        ? "border-primary/35 bg-primary/5"
                        : "border-border/50 bg-background/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {connection.organization.name}
                        </p>
                        <h4 className="mt-1 text-base font-semibold text-foreground">
                          {connection.provider.name}
                        </h4>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {connection.provider.discoveryUrl}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
                          providerStatusClasses[connection.provider.status],
                        )}
                      >
                        {getProviderStatusLabel(connection.provider.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                          Client ID
                        </p>
                        <p className="mt-1 break-all text-foreground">
                          {connection.provider.clientId}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-secondary/20 p-3">
                        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                          Scopes
                        </p>
                        <p className="mt-1 text-foreground">
                          {connection.provider.scopes.join(", ")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-medium text-foreground">
                        Authenticate as
                      </p>
                      <div className="mt-2 grid gap-2">
                        {connection.profiles.map((profile) => {
                          const isActiveSession =
                            authSession.method === "oidc" &&
                            authSession.providerId === connection.provider.id &&
                            authSession.userId === profile.user.id;

                          return (
                            <button
                              key={`${connection.provider.id}:${profile.user.id}`}
                              type="button"
                              onClick={() =>
                                onSignInWithOidc(
                                  connection.provider.id,
                                  profile.user.id,
                                )
                              }
                              aria-pressed={isActiveSession}
                              aria-label={`Authenticate with ${connection.provider.name} as ${profile.user.name}, ${getMembershipRoleLabel(profile.membership.role)}`}
                              className={cn(
                                "focus-ring flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors",
                                isActiveSession
                                  ? "border-emerald-500/35 bg-emerald-500/10"
                                  : "border-border/50 bg-secondary/20 hover:border-primary/20 hover:bg-accent/40",
                              )}
                            >
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {profile.user.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {profile.user.email}
                                </p>
                              </div>
                              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                {getMembershipRoleLabel(profile.membership.role)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
