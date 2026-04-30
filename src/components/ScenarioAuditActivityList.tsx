import React from "react";
import type { ScenarioAuditEvent } from "@/lib/scenarioWorkspace";
import { cn } from "@/lib/utils";

interface ScenarioAuditActivityListProps {
  events: ScenarioAuditEvent[];
  emptyMessage: string;
  compact?: boolean;
}

const auditEventLabelMap: Record<ScenarioAuditEvent["type"], string> = {
  "scenario.created": "Created",
  "scenario.imported": "Imported",
  "scenario.updated": "Updated",
  "scenario.deleted": "Deleted",
  "scenario.selected": "Selected",
  "scenario.published": "Published",
  "scenario.exported": "Exported",
  "replay.snapshot.captured": "Snapshot",
  "replay.playback.completed": "Playback",
};

const auditEventToneMap: Record<ScenarioAuditEvent["type"], string> = {
  "scenario.created": "bg-primary/10 text-primary",
  "scenario.imported": "bg-severity-info/15 text-severity-info",
  "scenario.updated": "bg-severity-medium/15 text-severity-medium",
  "scenario.deleted": "bg-severity-critical/15 text-severity-critical",
  "scenario.selected": "bg-secondary text-muted-foreground",
  "scenario.published": "bg-severity-low/15 text-severity-low",
  "scenario.exported": "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  "replay.snapshot.captured": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "replay.playback.completed": "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getEventMeta(event: ScenarioAuditEvent) {
  const meta: string[] = [];

  if (event.actorName) {
    meta.push(event.actorRole ? `${event.actorName} (${event.actorRole})` : event.actorName);
  }

  if (event.scenarioName) {
    meta.push(event.scenarioName);
  }

  if (event.revision) {
    meta.push(`r${event.revision}`);
  }

  if (event.source) {
    meta.push(event.source);
  }

  if (event.trigger) {
    meta.push(event.trigger);
  }

  if (event.currentTime != null) {
    meta.push(formatSeconds(event.currentTime));
  }

  if (event.activeEventCount != null) {
    meta.push(`${event.activeEventCount} active events`);
  }

  if (event.changeCount && event.changeCount > 1) {
    meta.push(`${event.changeCount} changes`);
  }

  return meta;
}

export function ScenarioAuditActivityList({
  events,
  emptyMessage,
  compact = false,
}: ScenarioAuditActivityListProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/50 px-2.5 py-3 text-[10px] text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", compact ? "space-y-1.5" : "space-y-2")}>
      {events.map((event) => {
        const meta = getEventMeta(event);

        return (
          <div
            key={event.id}
            className={cn(
              "rounded-lg border border-border/50 bg-secondary/20",
              compact ? "px-2.5 py-2" : "px-3 py-3",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                  auditEventToneMap[event.type],
                )}
              >
                {auditEventLabelMap[event.type]}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {formatTimestamp(event.createdAt)}
              </span>
            </div>

            <p className={cn("mt-2 text-foreground", compact ? "text-[10px]" : "text-xs")}>
              {event.message}
            </p>

            {meta.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {meta.map((item) => (
                  <span
                    key={`${event.id}-${item}`}
                    className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
