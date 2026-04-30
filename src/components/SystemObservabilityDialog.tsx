import React from "react";
import {
  Activity,
  AlertTriangle,
  Gauge,
  Laptop2,
  ServerCrash,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ScenarioBackendSystemLog,
  ScenarioBackendTelemetrySample,
  ScenarioSystemLogLevel,
  ScenarioTelemetryUnit,
} from "@/lib/scenarioBackendModels";
import { cn } from "@/lib/utils";

interface SystemObservabilityDialogProps {
  logs: ScenarioBackendSystemLog[];
  telemetrySamples: ScenarioBackendTelemetrySample[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const logToneMap: Record<ScenarioSystemLogLevel, string> = {
  info: "bg-primary/10 text-primary",
  warn: "bg-severity-medium/15 text-severity-medium",
  error: "bg-severity-critical/15 text-severity-critical",
};

const telemetryToneMap: Record<
  ScenarioBackendTelemetrySample["status"],
  string
> = {
  ok: "bg-primary/10 text-primary",
  warn: "bg-severity-medium/15 text-severity-medium",
  error: "bg-severity-critical/15 text-severity-critical",
};

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatTelemetryValue(value: number, unit: ScenarioTelemetryUnit) {
  switch (unit) {
    case "ms":
      return `${value.toFixed(2)} ms`;
    case "bytes":
      return `${Math.round(value).toLocaleString()} bytes`;
    case "ratio":
      return `${(value * 100).toFixed(1)}%`;
    case "count":
    default:
      return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  }
}

function averageLatency(samples: ScenarioBackendTelemetrySample[]) {
  const latencySamples = samples.filter((sample) => sample.unit === "ms");
  if (latencySamples.length === 0) return null;

  return (
    latencySamples.reduce((sum, sample) => sum + sample.value, 0) /
    latencySamples.length
  );
}

function LogList({ logs }: { logs: ScenarioBackendSystemLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-sm text-muted-foreground">
        No system logs captured for this filter yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="rounded-xl border border-border/50 bg-secondary/20 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                  logToneMap[log.level],
                )}
              >
                {log.level}
              </span>
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {log.category}
              </span>
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {log.event}
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {formatTimestamp(log.createdAt)}
            </span>
          </div>

          <p className="mt-2 text-sm text-foreground">{log.message}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {log.actorName ? (
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {log.actorRole ? `${log.actorName} (${log.actorRole})` : log.actorName}
              </span>
            ) : null}
            {log.route ? (
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {log.route}
              </span>
            ) : null}
            {log.scenarioName ? (
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {log.scenarioName}
              </span>
            ) : null}
            <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {log.requestId.slice(-8)}
            </span>
          </div>

          {Object.keys(log.details).length > 0 ? (
            <div className="mt-3 grid gap-2 rounded-lg border border-border/40 bg-background/40 p-3 sm:grid-cols-2">
              {Object.entries(log.details).map(([key, value]) => (
                <div key={`${log.id}-${key}`} className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {key}
                  </p>
                  <p className="truncate text-xs text-foreground">
                    {String(value)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {log.errorStack ? (
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border/40 bg-background/40 p-3 text-[10px] leading-5 text-muted-foreground">
              {log.errorStack}
            </pre>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function TelemetryList({
  samples,
  emptyMessage,
}: {
  samples: ScenarioBackendTelemetrySample[];
  emptyMessage: string;
}) {
  if (samples.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {samples.map((sample) => (
        <div
          key={sample.id}
          className="rounded-xl border border-border/50 bg-secondary/20 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider",
                  telemetryToneMap[sample.status],
                )}
              >
                {sample.status}
              </span>
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {sample.source}
              </span>
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {sample.scope}
              </span>
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {sample.name}
              </span>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-foreground">
                {formatTelemetryValue(sample.value, sample.unit)}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {formatTimestamp(sample.createdAt)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {sample.actorName ? (
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {sample.actorRole
                  ? `${sample.actorName} (${sample.actorRole})`
                  : sample.actorName}
              </span>
            ) : null}
            {sample.route ? (
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {sample.route}
              </span>
            ) : null}
            {sample.scenarioName ? (
              <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                {sample.scenarioName}
              </span>
            ) : null}
            <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {sample.requestId.slice(-8)}
            </span>
          </div>

          {Object.keys(sample.details).length > 0 ? (
            <div className="mt-3 grid gap-2 rounded-lg border border-border/40 bg-background/40 p-3 sm:grid-cols-2">
              {Object.entries(sample.details).map(([key, value]) => (
                <div key={`${sample.id}-${key}`} className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {key}
                  </p>
                  <p className="truncate text-xs text-foreground">
                    {String(value)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function SystemObservabilityDialog({
  logs,
  telemetrySamples,
  open,
  onOpenChange,
}: SystemObservabilityDialogProps) {
  const errorLogs = React.useMemo(
    () => logs.filter((log) => log.level === "error"),
    [logs],
  );
  const warnLogs = React.useMemo(
    () => logs.filter((log) => log.level === "warn"),
    [logs],
  );
  const clientTelemetry = React.useMemo(
    () => telemetrySamples.filter((sample) => sample.source === "client"),
    [telemetrySamples],
  );
  const backendTelemetry = React.useMemo(
    () => telemetrySamples.filter((sample) => sample.source === "mock-backend"),
    [telemetrySamples],
  );
  const avgClientLatency = React.useMemo(
    () => averageLatency(clientTelemetry),
    [clientTelemetry],
  );
  const avgBackendLatency = React.useMemo(
    () => averageLatency(backendTelemetry),
    [backendTelemetry],
  );
  const latestBrowserSample = React.useMemo(
    () => clientTelemetry.find((sample) => sample.scope === "browser") ?? null,
    [clientTelemetry],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl border-border/60 bg-background/95 p-0 shadow-2xl">
        <div className="border-b border-border/50 bg-gradient-to-br from-red-500/10 via-background to-cyan-500/10 px-6 py-5">
          <DialogHeader className="text-left">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
              <ServerCrash className="h-4 w-4" />
            </div>
            <DialogTitle>System observability</DialogTitle>
            <DialogDescription>
              Structured logs plus tenant-scoped telemetry for client behavior,
              mock-backend operations, and recovery signals.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border/50 bg-background/50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Activity className="h-4 w-4 text-primary" />
                {logs.length} log events
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Errors, warnings, and structured workflow logs.
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Laptop2 className="h-4 w-4 text-primary" />
                {clientTelemetry.length} client samples
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Avg latency {avgClientLatency != null ? `${avgClientLatency.toFixed(2)} ms` : "n/a"}.
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Gauge className="h-4 w-4 text-primary" />
                {backendTelemetry.length} backend samples
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Avg latency {avgBackendLatency != null ? `${avgBackendLatency.toFixed(2)} ms` : "n/a"}.
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-background/50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-severity-medium" />
                Browser caveat
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Client telemetry is best-effort and can be incomplete in privacy-restricted or background-tab conditions.
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="p-6 pt-5">
          <TabsList className="grid w-full grid-cols-4 bg-secondary/40">
            <TabsTrigger value="overview" className="text-xs">
              Overview
            </TabsTrigger>
            <TabsTrigger value="client" className="text-xs">
              Client telemetry
            </TabsTrigger>
            <TabsTrigger value="backend" className="text-xs">
              Backend telemetry
            </TabsTrigger>
            <TabsTrigger value="logs" className="text-xs">
              System logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Observability posture
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    The simulator now captures backend-style action latency plus
                    best-effort browser/client signals in the same tenant namespace.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                      Latest browser sample
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {latestBrowserSample?.name ?? "Not captured yet"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {latestBrowserSample
                        ? formatTelemetryValue(
                            latestBrowserSample.value,
                            latestBrowserSample.unit,
                          )
                        : "Open the workspace in a browser to capture capability samples."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/80">
                      Recent errors
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {errorLogs.length} captured
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Warnings {warnLogs.length}. Use the logs tab for detailed triage.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Browser telemetry caveat
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Client-side timing is directional, not authoritative.
                  </p>
                </div>

                <div className="rounded-2xl border border-dashed border-border/50 px-4 py-4 text-xs leading-6 text-muted-foreground">
                  Browser telemetry can be throttled in background tabs, partially
                  unavailable across engines, blocked by privacy settings, or
                  interrupted during unload/navigation. Treat client metrics as
                  best-effort signals and rely on backend-side operation timings
                  when you need a more stable baseline.
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="client">
            <ScrollArea className="h-[480px] pr-4">
              <div className="pb-4">
                <TelemetryList
                  samples={clientTelemetry}
                  emptyMessage="No client telemetry samples captured yet."
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="backend">
            <ScrollArea className="h-[480px] pr-4">
              <div className="pb-4">
                <TelemetryList
                  samples={backendTelemetry}
                  emptyMessage="No mock-backend telemetry samples captured yet."
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="logs">
            <Tabs defaultValue="errors">
              <TabsList className="grid w-full grid-cols-3 bg-secondary/40">
                <TabsTrigger value="errors" className="text-xs">
                  Errors
                </TabsTrigger>
                <TabsTrigger value="warnings" className="text-xs">
                  Warnings
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs">
                  All events
                </TabsTrigger>
              </TabsList>

              <TabsContent value="errors">
                <ScrollArea className="h-[420px] pr-4">
                  <div className="pb-4">
                    <LogList logs={errorLogs} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="warnings">
                <ScrollArea className="h-[420px] pr-4">
                  <div className="pb-4">
                    <LogList logs={warnLogs} />
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="all">
                <ScrollArea className="h-[420px] pr-4">
                  <div className="pb-4">
                    <LogList logs={logs} />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
