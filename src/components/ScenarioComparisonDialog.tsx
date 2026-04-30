import React from "react";
import {
  ArrowRight,
  Clock3,
  GitCompareArrows,
  History,
  Layers3,
  PlayCircle,
  Radar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ScenarioBackendReplaySnapshot } from "@/lib/scenarioBackendModels";
import {
  compareReplaySnapshots,
  compareScenarioVersions,
  type ScenarioComparisonFieldChange,
  type ScenarioRevisionEntityChange,
} from "@/lib/scenarioComparison";
import type { ScenarioWorkspaceEntry } from "@/lib/scenarioWorkspace";
import {
  getCurrentScenarioVersion,
  getPublishedScenarioVersion,
  getScenarioVersionByRevision,
} from "@/lib/scenarioWorkspace";
import { cn } from "@/lib/utils";

interface ScenarioComparisonDialogProps {
  entry: ScenarioWorkspaceEntry;
  selectedRevision: number | null;
  replaySnapshots: ScenarioBackendReplaySnapshot[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ComparisonTab = "revisions" | "replay";

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatVersionSource(value: string) {
  switch (value) {
    case "builder":
      return "Builder";
    case "import":
      return "Import";
    case "edit":
      return "Draft edit";
    case "builtin":
      return "Catalog";
    default:
      return value;
  }
}

function describeSnapshot(snapshot: ScenarioBackendReplaySnapshot, revision: number | null) {
  return `${snapshot.trigger} • ${snapshot.currentTime}s • ${revision ? `r${revision}` : "no revision"}`;
}

function findDefaultVersionIds(
  entry: ScenarioWorkspaceEntry,
  selectedRevision: number | null,
) {
  const currentVersion = getCurrentScenarioVersion(entry);
  const publishedVersion = getPublishedScenarioVersion(entry);
  const targetVersion =
    (selectedRevision != null
      ? getScenarioVersionByRevision(entry, selectedRevision)
      : null) ?? currentVersion;
  const sortedVersions = entry.versions
    .slice()
    .sort((left, right) => right.revision - left.revision);
  const baseVersion =
    (publishedVersion && publishedVersion.id !== targetVersion.id
      ? publishedVersion
      : sortedVersions.find((version) => version.id !== targetVersion.id)) ??
    targetVersion;

  return {
    baseVersionId: baseVersion.id,
    targetVersionId: targetVersion.id,
  };
}

function findDefaultSnapshotIds(replaySnapshots: ScenarioBackendReplaySnapshot[]) {
  const sortedSnapshots = replaySnapshots
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const targetSnapshot = sortedSnapshots[0] ?? null;
  const baseSnapshot = sortedSnapshots[1] ?? targetSnapshot;

  return {
    baseSnapshotId: baseSnapshot?.id ?? null,
    targetSnapshotId: targetSnapshot?.id ?? null,
  };
}

function ChangeBadge({
  kind,
}: {
  kind: "added" | "removed" | "changed";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]",
        kind === "added" && "bg-severity-low/10 text-severity-low",
        kind === "removed" && "bg-severity-critical/10 text-severity-critical",
        kind === "changed" && "bg-severity-medium/10 text-severity-medium",
      )}
    >
      {kind}
    </span>
  );
}

function ComparisonMetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "positive" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-secondary/20 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl text-foreground",
          tone === "positive" && "text-severity-low",
          tone === "warning" && "text-severity-medium",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FieldChangeList({
  changes,
  emptyMessage,
}: {
  changes: ScenarioComparisonFieldChange[];
  emptyMessage: string;
}) {
  if (changes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 px-4 py-4 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {changes.map((change) => (
        <article
          key={`${change.field}:${change.before}:${change.after}`}
          className="rounded-2xl border border-border/50 bg-secondary/20 p-4"
        >
          <p className="text-sm font-semibold text-foreground">{change.field}</p>
          <div className="mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-xl border border-border/40 bg-background/50 px-3 py-2">
              {change.before}
            </div>
            <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-foreground">
              {change.after}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function EntityChangeList({
  changes,
  emptyMessage,
}: {
  changes: ScenarioRevisionEntityChange[];
  emptyMessage: string;
}) {
  if (changes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 px-4 py-4 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {changes.map((change) => (
        <article
          key={`${change.id}:${change.kind}`}
          className="rounded-2xl border border-border/50 bg-secondary/20 p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <ChangeBadge kind={change.kind} />
            <p className="text-sm font-semibold text-foreground">{change.label}</p>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{change.description}</p>
          {change.changes.length > 0 ? (
            <div className="mt-3 space-y-2">
              {change.changes.map((fieldChange) => (
                <div
                  key={`${change.id}:${fieldChange.field}`}
                  className="rounded-xl border border-border/40 bg-background/50 px-3 py-3 text-xs text-muted-foreground"
                >
                  <p className="font-semibold text-foreground">{fieldChange.field}</p>
                  <p className="mt-1">{fieldChange.before}</p>
                  <p className="mt-1 text-foreground">{fieldChange.after}</p>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function ScenarioComparisonDialog({
  entry,
  selectedRevision,
  replaySnapshots,
  open,
  onOpenChange,
}: ScenarioComparisonDialogProps) {
  const versionOptions = React.useMemo(
    () =>
      entry.versions
        .slice()
        .sort((left, right) => right.revision - left.revision),
    [entry.versions],
  );
  const snapshotOptions = React.useMemo(
    () =>
      replaySnapshots
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    [replaySnapshots],
  );
  const hasRevisionComparison = versionOptions.length > 1;
  const hasReplayComparison = snapshotOptions.length > 1;
  const [activeTab, setActiveTab] = React.useState<ComparisonTab>(
    hasRevisionComparison ? "revisions" : "replay",
  );
  const [baseVersionId, setBaseVersionId] = React.useState<string>("");
  const [targetVersionId, setTargetVersionId] = React.useState<string>("");
  const [baseSnapshotId, setBaseSnapshotId] = React.useState<string>("");
  const [targetSnapshotId, setTargetSnapshotId] = React.useState<string>("");

  React.useEffect(() => {
    const nextTab: ComparisonTab = hasRevisionComparison ? "revisions" : "replay";
    setActiveTab(nextTab);

    const versionDefaults = findDefaultVersionIds(entry, selectedRevision);
    setBaseVersionId(versionDefaults.baseVersionId);
    setTargetVersionId(versionDefaults.targetVersionId);

    const snapshotDefaults = findDefaultSnapshotIds(replaySnapshots);
    setBaseSnapshotId(snapshotDefaults.baseSnapshotId ?? "");
    setTargetSnapshotId(snapshotDefaults.targetSnapshotId ?? "");
  }, [entry, hasRevisionComparison, replaySnapshots, selectedRevision]);

  const baseVersion =
    versionOptions.find((version) => version.id === baseVersionId) ??
    versionOptions[1] ??
    versionOptions[0] ??
    null;
  const targetVersion =
    versionOptions.find((version) => version.id === targetVersionId) ??
    versionOptions[0] ??
    null;
  const revisionComparison =
    baseVersion && targetVersion
      ? compareScenarioVersions(baseVersion, targetVersion)
      : null;

  const baseSnapshot =
    snapshotOptions.find((snapshot) => snapshot.id === baseSnapshotId) ??
    snapshotOptions[1] ??
    snapshotOptions[0] ??
    null;
  const targetSnapshot =
    snapshotOptions.find((snapshot) => snapshot.id === targetSnapshotId) ??
    snapshotOptions[0] ??
    null;
  const replayComparison =
    baseSnapshot && targetSnapshot
      ? compareReplaySnapshots({
          baseSnapshot,
          targetSnapshot,
          versionRecords: entry.versions,
        })
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden border-border/60 bg-background/95 p-0 shadow-2xl">
        <div className="border-b border-border/50 bg-gradient-to-br from-blue-500/10 via-background to-cyan-500/10 p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-primary" />
              Scenario comparison
            </DialogTitle>
            <DialogDescription>
              Compare revisions to understand how the scenario model changed, or
              compare replay snapshots to see how incident state shifted over time.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="overflow-y-auto p-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ComparisonTab)}
            className="space-y-4"
          >
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="revisions" disabled={!hasRevisionComparison}>
                Revision diff
              </TabsTrigger>
              <TabsTrigger value="replay" disabled={!hasReplayComparison}>
                Replay compare
              </TabsTrigger>
            </TabsList>

            <TabsContent value="revisions" className="space-y-5">
              {!hasRevisionComparison || !revisionComparison ? (
                <div className="rounded-2xl border border-dashed border-border/50 px-4 py-5 text-sm text-muted-foreground">
                  This scenario does not have enough saved revisions to compare yet.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className="rounded-2xl border border-border/50 bg-secondary/15 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Base revision</h3>
                      </div>
                      <div className="space-y-2">
                        {versionOptions.map((version) => {
                          const isActive = baseVersion.id === version.id;
                          return (
                            <button
                              key={`base-${version.id}`}
                              type="button"
                              onClick={() => setBaseVersionId(version.id)}
                              className={cn(
                                "focus-ring w-full rounded-xl border px-3 py-3 text-left transition-colors",
                                isActive
                                  ? "border-primary/40 bg-primary/10"
                                  : "border-border/50 bg-background/55 hover:border-primary/20 hover:bg-accent/30",
                              )}
                            >
                              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
                                Revision {version.revision}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatVersionSource(version.source)} • {formatTimestamp(version.createdAt)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-border/50 bg-secondary/15 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Radar className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Target revision</h3>
                      </div>
                      <div className="space-y-2">
                        {versionOptions.map((version) => {
                          const isActive = targetVersion.id === version.id;
                          return (
                            <button
                              key={`target-${version.id}`}
                              type="button"
                              onClick={() => setTargetVersionId(version.id)}
                              className={cn(
                                "focus-ring w-full rounded-xl border px-3 py-3 text-left transition-colors",
                                isActive
                                  ? "border-primary/40 bg-primary/10"
                                  : "border-border/50 bg-background/55 hover:border-primary/20 hover:bg-accent/30",
                              )}
                            >
                              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">
                                Revision {version.revision}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatVersionSource(version.source)} • {formatTimestamp(version.createdAt)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <ComparisonMetricCard
                      label="Total changes"
                      value={revisionComparison.summary.totalChanges}
                      tone={
                        revisionComparison.summary.totalChanges > 0 ? "warning" : "positive"
                      }
                    />
                    <ComparisonMetricCard
                      label="Metadata"
                      value={revisionComparison.summary.metadataChanges}
                    />
                    <ComparisonMetricCard
                      label="Nodes"
                      value={
                        revisionComparison.summary.nodeAdded +
                        revisionComparison.summary.nodeRemoved +
                        revisionComparison.summary.nodeChanged
                      }
                    />
                    <ComparisonMetricCard
                      label="Events"
                      value={
                        revisionComparison.summary.eventAdded +
                        revisionComparison.summary.eventRemoved +
                        revisionComparison.summary.eventChanged
                      }
                    />
                    <ComparisonMetricCard
                      label="Narrative"
                      value={revisionComparison.summary.narrativeChanges}
                    />
                  </div>

                  <section className="space-y-5">
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-foreground">
                        Scenario metadata
                      </h3>
                      <FieldChangeList
                        changes={revisionComparison.metadataChanges}
                        emptyMessage="No top-level metadata changed between these revisions."
                      />
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-foreground">
                        Topology nodes
                      </h3>
                      <EntityChangeList
                        changes={revisionComparison.nodeChanges}
                        emptyMessage="Node topology is unchanged between these revisions."
                      />
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-foreground">
                        Topology edges
                      </h3>
                      <EntityChangeList
                        changes={revisionComparison.edgeChanges}
                        emptyMessage="Edge connectivity is unchanged between these revisions."
                      />
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-foreground">
                        Timeline events
                      </h3>
                      <EntityChangeList
                        changes={revisionComparison.eventChanges}
                        emptyMessage="Timeline events are unchanged between these revisions."
                      />
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-foreground">
                        Incident narrative
                      </h3>
                      <FieldChangeList
                        changes={revisionComparison.narrativeChanges}
                        emptyMessage="Narrative summaries and action items are unchanged."
                      />
                    </div>
                  </section>
                </>
              )}
            </TabsContent>

            <TabsContent value="replay" className="space-y-5">
              {!hasReplayComparison || !replayComparison ? (
                <div className="rounded-2xl border border-dashed border-border/50 px-4 py-5 text-sm text-muted-foreground">
                  Capture at least two replay snapshots to compare incident progression.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className="rounded-2xl border border-border/50 bg-secondary/15 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <PlayCircle className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Earlier snapshot</h3>
                      </div>
                      <div className="space-y-2">
                        {snapshotOptions.map((snapshot) => {
                          const revision =
                            entry.versions.find(
                              (version) => version.id === snapshot.scenarioVersionId,
                            )?.revision ?? null;
                          const isActive = baseSnapshot.id === snapshot.id;

                          return (
                            <button
                              key={`snapshot-base-${snapshot.id}`}
                              type="button"
                              onClick={() => setBaseSnapshotId(snapshot.id)}
                              className={cn(
                                "focus-ring w-full rounded-xl border px-3 py-3 text-left transition-colors",
                                isActive
                                  ? "border-primary/40 bg-primary/10"
                                  : "border-border/50 bg-background/55 hover:border-primary/20 hover:bg-accent/30",
                              )}
                            >
                              <p className="text-sm font-medium text-foreground">
                                {describeSnapshot(snapshot, revision)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatTimestamp(snapshot.createdAt)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-border/50 bg-secondary/15 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Layers3 className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Later snapshot</h3>
                      </div>
                      <div className="space-y-2">
                        {snapshotOptions.map((snapshot) => {
                          const revision =
                            entry.versions.find(
                              (version) => version.id === snapshot.scenarioVersionId,
                            )?.revision ?? null;
                          const isActive = targetSnapshot.id === snapshot.id;

                          return (
                            <button
                              key={`snapshot-target-${snapshot.id}`}
                              type="button"
                              onClick={() => setTargetSnapshotId(snapshot.id)}
                              className={cn(
                                "focus-ring w-full rounded-xl border px-3 py-3 text-left transition-colors",
                                isActive
                                  ? "border-primary/40 bg-primary/10"
                                  : "border-border/50 bg-background/55 hover:border-primary/20 hover:bg-accent/30",
                              )}
                            >
                              <p className="text-sm font-medium text-foreground">
                                {describeSnapshot(snapshot, revision)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatTimestamp(snapshot.createdAt)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <ComparisonMetricCard
                      label="Node state changes"
                      value={replayComparison.summary.nodeStateChanges}
                    />
                    <ComparisonMetricCard
                      label="Events activated"
                      value={replayComparison.summary.eventsActivated}
                      tone={replayComparison.summary.eventsActivated > 0 ? "warning" : "positive"}
                    />
                    <ComparisonMetricCard
                      label="Events resolved"
                      value={replayComparison.summary.eventsResolved}
                      tone={replayComparison.summary.eventsResolved > 0 ? "positive" : "default"}
                    />
                    <ComparisonMetricCard
                      label="Time delta"
                      value={`${replayComparison.summary.timeDeltaSeconds}s`}
                    />
                  </div>

                  <section className="space-y-5">
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-foreground">
                        Snapshot context
                      </h3>
                      <FieldChangeList
                        changes={replayComparison.contextChanges}
                        emptyMessage="These snapshots were captured from the same trigger, time, and revision context."
                      />
                    </div>

                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-foreground">
                        Node state transitions
                      </h3>
                      {replayComparison.nodeStateChanges.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/50 px-4 py-4 text-sm text-muted-foreground">
                          No node state changed between these snapshots.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {replayComparison.nodeStateChanges.map((change) => (
                            <article
                              key={change.nodeId}
                              className="rounded-2xl border border-border/50 bg-secondary/20 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-foreground">
                                  {change.label}
                                </p>
                                <Clock3 className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="mt-3 grid gap-2 text-sm text-muted-foreground md:grid-cols-[1fr_auto_1fr] md:items-center">
                                <div className="rounded-xl border border-border/40 bg-background/50 px-3 py-2">
                                  {change.beforeStatus}
                                </div>
                                <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
                                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-foreground">
                                  {change.afterStatus}
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid gap-5 lg:grid-cols-2">
                      <section>
                        <h3 className="mb-3 text-sm font-semibold text-foreground">
                          Events activated
                        </h3>
                        {replayComparison.activatedEvents.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border/50 px-4 py-4 text-sm text-muted-foreground">
                            No newly active events in the later snapshot.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {replayComparison.activatedEvents.map((event) => (
                              <article
                                key={`activated-${event.id}`}
                                className="rounded-2xl border border-border/50 bg-secondary/20 p-4"
                              >
                                <p className="text-sm font-semibold text-foreground">{event.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {event.timestamp != null ? `${event.timestamp}s` : "Unknown time"} • {event.severity}
                                </p>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>

                      <section>
                        <h3 className="mb-3 text-sm font-semibold text-foreground">
                          Events resolved
                        </h3>
                        {replayComparison.resolvedEvents.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border/50 px-4 py-4 text-sm text-muted-foreground">
                            No active events were cleared between these snapshots.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {replayComparison.resolvedEvents.map((event) => (
                              <article
                                key={`resolved-${event.id}`}
                                className="rounded-2xl border border-border/50 bg-secondary/20 p-4"
                              >
                                <p className="text-sm font-semibold text-foreground">{event.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {event.timestamp != null ? `${event.timestamp}s` : "Unknown time"} • {event.severity}
                                </p>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  </section>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
