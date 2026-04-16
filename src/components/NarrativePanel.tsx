import React from "react";
import type { IncidentNarrative, Severity } from "@/data/scenarios";
import { Shield, FileText, Target, CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  narrative: IncidentNarrative;
  severity: Severity;
  progress: number; // 0-1
}

const severityBadge: Record<Severity, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-severity-critical/20", text: "text-severity-critical", label: "CRITICAL" },
  high: { bg: "bg-severity-high/20", text: "text-severity-high", label: "HIGH" },
  medium: { bg: "bg-severity-medium/20", text: "text-severity-medium", label: "MEDIUM" },
  low: { bg: "bg-severity-low/20", text: "text-severity-low", label: "LOW" },
  info: { bg: "bg-severity-info/20", text: "text-severity-info", label: "INFO" },
};

export const NarrativePanel: React.FC<Props> = ({ narrative, severity, progress }) => {
  const badge = severityBadge[severity];
  const showTech = progress > 0.3;
  const showRoot = progress > 0.5;
  const showActions = progress > 0.7;

  return (
    <div className="glass-panel p-4 h-full flex flex-col overflow-y-auto scrollbar-thin">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">Incident Narrative</h3>
        </div>
        <div className={`${badge.bg} ${badge.text} px-2 py-0.5 rounded-sm font-mono text-[10px] font-bold`}>
          {badge.label}
        </div>
      </div>

      {/* Impact Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Impact Score</span>
          <span className={`font-mono text-sm font-bold ${
            narrative.impactScore >= 80 ? "text-severity-critical" :
            narrative.impactScore >= 50 ? "text-severity-high" :
            "text-severity-medium"
          }`}>
            {Math.round(narrative.impactScore * progress)}
          </span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              narrative.impactScore >= 80 ? "bg-severity-critical" :
              narrative.impactScore >= 50 ? "bg-severity-high" :
              "bg-severity-medium"
            }`}
            style={{ width: `${narrative.impactScore * progress}%` }}
          />
        </div>
      </div>

      {/* Executive Summary */}
      <div className="mb-4 animate-fade-in-up">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Shield className="h-3 w-3 text-primary" />
          <span className="font-heading text-[10px] uppercase tracking-wider text-primary">Executive Summary</span>
        </div>
        <p className="text-xs text-foreground/80 leading-relaxed">{narrative.executiveSummary}</p>
      </div>

      {/* Technical Summary */}
      {showTech && (
        <div className="mb-4 animate-fade-in-up">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target className="h-3 w-3 text-severity-info" />
            <span className="font-heading text-[10px] uppercase tracking-wider text-severity-info">Technical Analysis</span>
          </div>
          <p className="text-xs text-foreground/70 leading-relaxed">{narrative.technicalSummary}</p>
        </div>
      )}

      {/* Root Cause */}
      {showRoot && (
        <div className="mb-4 animate-fade-in-up">
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="h-3 w-3 text-severity-high" />
            <span className="font-heading text-[10px] uppercase tracking-wider text-severity-high">Root Cause</span>
          </div>
          <p className="text-xs text-foreground/70 leading-relaxed">{narrative.rootCause}</p>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 className="h-3 w-3 text-severity-low" />
            <span className="font-heading text-[10px] uppercase tracking-wider text-severity-low">Recommended Actions</span>
          </div>
          <ul className="space-y-1">
            {narrative.actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                <span className="font-mono text-[10px] text-muted-foreground mt-0.5">{(i + 1).toString().padStart(2, "0")}</span>
                <span className="leading-relaxed">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {progress === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-xs font-mono">Narrative reveals as incident unfolds...</p>
        </div>
      )}
    </div>
  );
};
