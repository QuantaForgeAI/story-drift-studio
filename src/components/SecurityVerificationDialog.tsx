import React from "react";
import { AlertTriangle, CheckCircle2, Shield, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ScenarioBackendAuthSession,
  ScenarioBackendSecurityVerificationRun,
} from "@/lib/scenarioBackendModels";
import { cn } from "@/lib/utils";

interface SecurityVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName: string;
  authSession: ScenarioBackendAuthSession;
  verificationRuns: ScenarioBackendSecurityVerificationRun[];
  onRunVerification: () => Promise<void> | void;
}

const statusClasses = {
  pass: "border-severity-low/40 bg-severity-low/15 text-severity-low",
  warn: "border-severity-medium/40 bg-severity-medium/15 text-severity-medium",
  fail: "border-severity-critical/40 bg-severity-critical/15 text-severity-critical",
} as const;

const severityClasses = {
  low: "text-severity-low",
  medium: "text-severity-medium",
  high: "text-severity-high",
  critical: "text-severity-critical",
} as const;

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SecurityVerificationDialog({
  open,
  onOpenChange,
  organizationName,
  authSession,
  verificationRuns,
  onRunVerification,
}: SecurityVerificationDialogProps) {
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(
    verificationRuns[0]?.id ?? null,
  );

  React.useEffect(() => {
    if (verificationRuns.length === 0) {
      setSelectedRunId(null);
      return;
    }

    setSelectedRunId((currentSelectedRunId) =>
      currentSelectedRunId &&
      verificationRuns.some((run) => run.id === currentSelectedRunId)
        ? currentSelectedRunId
        : verificationRuns[0].id,
    );
  }, [verificationRuns]);

  const selectedRun =
    verificationRuns.find((run) => run.id === selectedRunId) ??
    verificationRuns[0] ??
    null;

  const groupedFindings = React.useMemo(() => {
    if (!selectedRun) {
      return [];
    }

    return Array.from(
      selectedRun.findings.reduce((groups, finding) => {
        const list = groups.get(finding.family) ?? [];
        list.push(finding);
        groups.set(finding.family, list);
        return groups;
      }, new Map<string, typeof selectedRun.findings>()),
    );
  }, [selectedRun]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden border-border/60 bg-background/95 p-0 shadow-2xl">
        <div className="border-b border-border/50 bg-gradient-to-br from-emerald-500/10 via-background to-cyan-500/10 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <DialogHeader className="text-left">
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Security verification
                </DialogTitle>
                <DialogDescription>
                  OWASP ASVS-aligned internal verification workflow for the active
                  workspace. This is useful evidence for release readiness, but it
                  is not a substitute for external penetration testing or formal
                  certification.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span>{organizationName}</span>
                <span>Current auth: {authSession.method}</span>
                <span>
                  {selectedRun
                    ? `Last run ${formatTimestamp(selectedRun.createdAt)}`
                    : "No verification run captured yet"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedRun ? (
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
                    statusClasses[selectedRun.overallStatus],
                  )}
                >
                  {selectedRun.overallStatus}
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={onRunVerification}
              >
                <Shield className="h-3.5 w-3.5" />
                Run verification
              </Button>
            </div>
          </div>

          {selectedRun ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-severity-low/20 bg-background/55 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-severity-low" />
                  <p className="text-sm font-semibold text-foreground">Pass</p>
                </div>
                <p className="mt-2 font-mono text-2xl text-severity-low">
                  {selectedRun.passCount}
                </p>
              </div>
              <div className="rounded-2xl border border-severity-medium/20 bg-background/55 px-4 py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-severity-medium" />
                  <p className="text-sm font-semibold text-foreground">Warn</p>
                </div>
                <p className="mt-2 font-mono text-2xl text-severity-medium">
                  {selectedRun.warnCount}
                </p>
              </div>
              <div className="rounded-2xl border border-severity-critical/20 bg-background/55 px-4 py-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-severity-critical" />
                  <p className="text-sm font-semibold text-foreground">Fail</p>
                </div>
                <p className="mt-2 font-mono text-2xl text-severity-critical">
                  {selectedRun.failCount}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 overflow-y-auto p-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section>
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-foreground">Recent runs</h4>
              <p className="text-xs text-muted-foreground">
                Re-run after security-sensitive changes to compare posture over time.
              </p>
            </div>

            {verificationRuns.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/50 px-4 py-5 text-sm text-muted-foreground">
                No ASVS-aligned verification run has been recorded yet. Run the
                workflow to generate a security report for this workspace.
              </div>
            ) : (
              <div className="space-y-2">
                {verificationRuns.map((run) => {
                  const isActive = run.id === selectedRun?.id;

                  return (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className={cn(
                        "focus-ring w-full rounded-2xl border p-3 text-left transition-colors",
                        isActive
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/50 bg-secondary/20 hover:border-primary/20 hover:bg-accent/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {run.framework}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(run.createdAt)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]",
                            statusClasses[run.overallStatus],
                          )}
                        >
                          {run.overallStatus}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {run.passCount} pass, {run.warnCount} warn, {run.failCount} fail
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-foreground">Control findings</h4>
              <p className="text-xs text-muted-foreground">
                Findings are grouped by OWASP ASVS family so teams can focus on the
                highest-risk gaps first.
              </p>
            </div>

            {selectedRun ? (
              <div className="space-y-5">
                {groupedFindings.map(([family, findings]) => (
                  <section key={family}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h5 className="text-sm font-semibold text-foreground">{family}</h5>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {findings.length} controls
                      </span>
                    </div>

                    <div className="space-y-2">
                      {findings.map((finding) => (
                        <article
                          key={finding.id}
                          className="rounded-2xl border border-border/50 bg-secondary/20 p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                              {finding.controlId}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]",
                                statusClasses[finding.status],
                              )}
                            >
                              {finding.status}
                            </span>
                            <span
                              className={cn(
                                "font-mono text-[10px] uppercase tracking-[0.18em]",
                                severityClasses[finding.severity],
                              )}
                            >
                              {finding.severity}
                            </span>
                          </div>
                          <h6 className="mt-2 text-sm font-semibold text-foreground">
                            {finding.title}
                          </h6>
                          <p className="mt-2 text-sm leading-6 text-foreground/85">
                            {finding.summary}
                          </p>
                          <div className="mt-3 rounded-xl border border-border/40 bg-background/50 px-3 py-3 text-xs leading-5 text-muted-foreground">
                            <p className="font-semibold text-foreground">Evidence</p>
                            <p className="mt-1">{finding.evidence}</p>
                            <p className="mt-3 font-semibold text-foreground">Recommended next step</p>
                            <p className="mt-1">{finding.remediation}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/50 px-4 py-5 text-sm text-muted-foreground">
                Run a verification to populate the OWASP ASVS-aligned control findings.
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
