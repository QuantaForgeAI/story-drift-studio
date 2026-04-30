import React from "react";
import type { Severity } from "@/data/scenarios";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface Props {
  currentTime: number;
  duration: number;
  eventsTriggered: number;
  totalEvents: number;
  severity: Severity;
  scenarioName: string;
  presentationMode?: boolean;
}

const severityConfig: Record<Severity, { color: string; bg: string }> = {
  critical: { color: "text-severity-critical", bg: "bg-severity-critical" },
  high: { color: "text-severity-high", bg: "bg-severity-high" },
  medium: { color: "text-severity-medium", bg: "bg-severity-medium" },
  low: { color: "text-severity-low", bg: "bg-severity-low" },
  info: { color: "text-severity-info", bg: "bg-severity-info" },
};

export const StatusBar: React.FC<Props> = ({
  currentTime,
  duration,
  eventsTriggered,
  totalEvents,
  severity,
  scenarioName,
  presentationMode = false,
}) => {
  const cfg = severityConfig[severity];
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <section
      className={`glass-panel flex items-center justify-between gap-6 ${
        presentationMode ? "px-5 py-3" : "px-4 py-2"
      }`}
      aria-label="Simulation status"
    >
      <div className="flex items-center gap-3">
        <div className={`h-2 w-2 rounded-full ${cfg.bg} ${currentTime > 0 && !prefersReducedMotion ? "animate-pulse" : ""}`} />
        <span className={`font-heading text-foreground ${presentationMode ? "text-sm" : "text-xs"}`}>
          {scenarioName}
        </span>
        {presentationMode ? (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
            Presenter
          </span>
        ) : null}
      </div>

      <div className={`flex-1 ${presentationMode ? "max-w-2xl" : "max-w-md"}`}>
        <div
          className="h-0.5 bg-secondary rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Simulation progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div className={`h-full ${cfg.bg} transition-all duration-500`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className={`flex items-center gap-4 font-mono text-muted-foreground ${presentationMode ? "text-xs" : "text-[10px]"}`}>
        <span>Events: <span className="text-foreground">{eventsTriggered}</span>/{totalEvents}</span>
        <span>Severity: <span className={cfg.color}>{severity.toUpperCase()}</span></span>
        <span className={currentTime > 0 ? "text-severity-critical" : ""}>
          {currentTime > 0 ? "● LIVE" : "○ STANDBY"}
        </span>
      </div>
    </section>
  );
};
