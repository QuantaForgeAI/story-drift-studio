import React from "react";
import type { Severity } from "@/data/scenarios";

interface Props {
  currentTime: number;
  duration: number;
  eventsTriggered: number;
  totalEvents: number;
  severity: Severity;
  scenarioName: string;
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
}) => {
  const cfg = severityConfig[severity];
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="glass-panel px-4 py-2 flex items-center justify-between gap-6">
      <div className="flex items-center gap-3">
        <div className={`h-2 w-2 rounded-full ${cfg.bg} ${currentTime > 0 ? "animate-pulse" : ""}`} />
        <span className="font-heading text-xs text-foreground">{scenarioName}</span>
      </div>

      <div className="flex-1 max-w-md">
        <div className="h-0.5 bg-secondary rounded-full overflow-hidden">
          <div className={`h-full ${cfg.bg} transition-all duration-500`} style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
        <span>Events: <span className="text-foreground">{eventsTriggered}</span>/{totalEvents}</span>
        <span>Severity: <span className={cfg.color}>{severity.toUpperCase()}</span></span>
        <span className={currentTime > 0 ? "text-severity-critical" : ""}>
          {currentTime > 0 ? "● LIVE" : "○ STANDBY"}
        </span>
      </div>
    </div>
  );
};
