import React from "react";
import { AlertTriangle, GitBranchPlus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ScenarioConflictError } from "@/lib/scenarioBackendRepository";

interface ScenarioConflictDialogProps {
  conflict: ScenarioConflictError | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewLatest: () => void;
  onSaveRecoveryRevision: () => void;
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function ScenarioConflictDialog({
  conflict,
  open,
  onOpenChange,
  onReviewLatest,
  onSaveRecoveryRevision,
}: ScenarioConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/60 bg-background/95 p-0 shadow-2xl">
        <div className="border-b border-border/50 bg-gradient-to-br from-amber-500/10 via-background to-red-500/10 px-6 py-5">
          <DialogHeader className="text-left">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-severity-medium/30 bg-severity-medium/10 text-severity-medium">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <DialogTitle>Draft conflict detected</DialogTitle>
            <DialogDescription>
              Another update landed while this draft was open. Review the latest revision before deciding whether to keep the new state or save your draft as a recovery revision.
            </DialogDescription>
          </DialogHeader>
        </div>

        {conflict ? (
          <div className="grid gap-4 p-6 md:grid-cols-2">
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
              <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Latest workspace state
              </p>
              <h3 className="mt-2 text-sm font-semibold text-foreground">
                {conflict.latestScenario.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Revision {conflict.latestRevision ?? "unknown"} updated{" "}
                {formatTimestamp(conflict.latestUpdatedAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {conflict.latestUpdatedByName ? (
                  <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {conflict.latestUpdatedByName}
                  </span>
                ) : null}
                <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  version {conflict.latestVersionId.slice(-6)}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
              <p className="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Your pending draft
              </p>
              <h3 className="mt-2 text-sm font-semibold text-foreground">
                {conflict.attemptedScenario.name}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Based on version {conflict.baseVersionId?.slice(-6) ?? "unknown"}.
                Saving it now will create a new recovery revision if the latest state still matches the current workspace.
              </p>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="flex-1 min-w-[180px] gap-2"
                onClick={onReviewLatest}
              >
                <RefreshCw className="h-4 w-4" />
                Review Latest Revision
              </Button>
              <Button
                className="flex-1 min-w-[220px] gap-2"
                onClick={onSaveRecoveryRevision}
              >
                <GitBranchPlus className="h-4 w-4" />
                Save Recovery Revision
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
