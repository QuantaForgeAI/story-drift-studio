import React from "react";
import { Copy, GitCompareArrows, History, Link2, Rocket, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScenarioAuditActivityList } from "@/components/ScenarioAuditActivityList";
import type { ScenarioBackendReplaySnapshot } from "@/lib/scenarioBackendModels";
import type {
  ScenarioAuditEvent,
  ScenarioWorkspaceEntry,
} from "@/lib/scenarioWorkspace";
import {
  getCurrentScenarioVersion,
  getPublishedScenarioVersion,
} from "@/lib/scenarioWorkspace";

const LazyScenarioAuditLogDialog = React.lazy(async () => {
  const module = await import("@/components/ScenarioAuditLogDialog");

  return { default: module.ScenarioAuditLogDialog };
});

const LazyScenarioComparisonDialog = React.lazy(async () => {
  const module = await import("@/components/ScenarioComparisonDialog");

  return { default: module.ScenarioComparisonDialog };
});

interface Props {
  entry: ScenarioWorkspaceEntry | null;
  scenarioName: string;
  selectedRevision: number | null;
  auditLog: ScenarioAuditEvent[];
  replaySnapshots: ScenarioBackendReplaySnapshot[];
  snapshotCount: number;
  latestSnapshotAt: string | null;
  lastSyncedAt: string;
  onSelectLatest: () => void;
  onSelectRevision: (revision: number) => void;
  onCopyLink: () => void;
  canCopyLink?: boolean;
  onPublishRevision?: (revision: number) => void;
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function ScenarioWorkspacePanel({
  entry,
  scenarioName,
  selectedRevision,
  auditLog,
  replaySnapshots,
  snapshotCount,
  latestSnapshotAt,
  lastSyncedAt,
  onSelectLatest,
  onSelectRevision,
  onCopyLink,
  canCopyLink = true,
  onPublishRevision,
}: Props) {
  const [isAuditDialogOpen, setIsAuditDialogOpen] = React.useState(false);
  const [isComparisonDialogOpen, setIsComparisonDialogOpen] = React.useState(false);

  if (!entry) return null;

  const currentVersion = getCurrentScenarioVersion(entry);
  const publishedVersion = getPublishedScenarioVersion(entry);
  const activeRevision = selectedRevision ?? currentVersion.revision;
  const canPublish =
    entry.origin === "custom" &&
    activeRevision !== (publishedVersion?.revision ?? null) &&
    onPublishRevision;
  const recentScenarioActivity = auditLog
    .filter((event) => event.scenarioId === entry.scenarioId)
    .slice(-4)
    .reverse();
  const canCompareScenario = entry.versions.length > 1 || replaySnapshots.length > 1;

  return (
    <>
      <section className="mt-3 glass-panel p-3 space-y-3" aria-labelledby="scenario-workspace-title">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            <h2 id="scenario-workspace-title" className="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Workspace
            </h2>
          </div>
          <span className="rounded-full border border-border/50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {entry.origin}
          </span>
        </div>
  
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-3">
          <p className="text-xs font-medium text-foreground truncate">{scenarioName}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary">
              Current r{currentVersion.revision}
            </span>
            {publishedVersion ? (
              <span className="rounded-full bg-severity-low/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-severity-low">
                Published r{publishedVersion.revision}
              </span>
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                Draft only
              </span>
            )}
            {selectedRevision && selectedRevision !== currentVersion.revision && (
              <span className="rounded-full bg-severity-medium/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-severity-medium">
                Viewing r{selectedRevision}
              </span>
            )}
            <span className="rounded-full bg-secondary/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {snapshotCount} snapshots
            </span>
          </div>
          {latestSnapshotAt && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Latest replay snapshot: {formatTimestamp(latestSnapshotAt)}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 min-w-[120px] text-[10px] gap-1.5"
              onClick={onCopyLink}
              disabled={!canCopyLink}
            >
              <Link2 className="h-3 w-3" />
              Copy Link
            </Button>
            {canCompareScenario ? (
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 min-w-[120px] text-[10px] gap-1.5"
                onClick={() => setIsComparisonDialogOpen(true)}
              >
                <GitCompareArrows className="h-3 w-3" />
                Compare
              </Button>
            ) : null}
            {canPublish && (
              <Button
                size="sm"
                className="h-7 flex-1 min-w-[120px] text-[10px] gap-1.5"
                onClick={() => onPublishRevision?.(activeRevision)}
              >
                <Rocket className="h-3 w-3" />
                Publish r{activeRevision}
              </Button>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <History className="h-3.5 w-3.5 text-primary" />
            <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Version History
            </span>
          </div>
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={onSelectLatest}
              aria-pressed={selectedRevision == null}
              className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left transition-all ${
                selectedRevision == null
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/50 bg-secondary/20 hover:border-border"
              } focus-ring`}
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-foreground">
                {entry.origin === "custom" ? "Latest draft" : "Catalog version"}
              </span>
              <span className="text-[10px] text-muted-foreground">
                r{currentVersion.revision}
              </span>
            </button>
            {entry.versions
              .slice()
              .sort((left, right) => right.revision - left.revision)
              .filter((version) => version.id !== currentVersion.id)
              .map((version) => {
                const isSelected = activeRevision === version.revision;
                const isPublished = publishedVersion?.revision === version.revision;

                return (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => onSelectRevision(version.revision)}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left transition-all ${
                      isSelected
                        ? "border-primary/40 bg-primary/10"
                        : "border-border/50 bg-secondary/20 hover:border-border"
                    } focus-ring`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-foreground">
                          r{version.revision}
                        </span>
                        {isPublished && (
                          <span className="rounded-full bg-severity-low/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-severity-low">
                            live
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {version.source} • {formatTimestamp(version.createdAt)}
                      </p>
                    </div>
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </button>
                );
              })}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ScrollText className="h-3.5 w-3.5 text-primary" />
              <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Recent Activity
              </span>
            </div>
            <span className="hidden text-[10px] text-muted-foreground sm:inline">
              Synced {formatTimestamp(lastSyncedAt)}
            </span>
          </div>
          <div className="mb-2 rounded-md border border-dashed border-border/50 px-2.5 py-2 text-[10px] text-muted-foreground">
            Live workspace sync is active. If another editor updates this scenario, this panel will refresh and stale saves will open a conflict review before anything is overwritten.
          </div>
          <div className="mb-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => setIsAuditDialogOpen(true)}
            >
              View Full Log
            </Button>
          </div>
          <ScenarioAuditActivityList
            events={recentScenarioActivity}
            emptyMessage="No workspace events recorded yet for this scenario."
            compact
          />
        </div>
      </section>

      {isAuditDialogOpen ? (
        <React.Suspense fallback={null}>
          <LazyScenarioAuditLogDialog
            auditLog={auditLog}
            scenarioId={entry.scenarioId}
            scenarioName={scenarioName}
            open={isAuditDialogOpen}
            onOpenChange={setIsAuditDialogOpen}
          />
        </React.Suspense>
      ) : null}

      {isComparisonDialogOpen ? (
        <React.Suspense fallback={null}>
          <LazyScenarioComparisonDialog
            entry={entry}
            selectedRevision={selectedRevision}
            replaySnapshots={replaySnapshots}
            open={isComparisonDialogOpen}
            onOpenChange={setIsComparisonDialogOpen}
          />
        </React.Suspense>
      ) : null}
    </>
  );
}
