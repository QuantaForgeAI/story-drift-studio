import React from "react";
import type { IncidentNarrative, Severity } from "@/data/scenarios";
import { Shield, FileText, Target, CheckCircle2, AlertTriangle } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface Props {
  narrative: IncidentNarrative;
  severity: Severity;
  progress: number; // 0-1
  presentationMode?: boolean;
}

const severityBadge: Record<Severity, { bg: string; text: string; label: string }> = {
  critical: { bg: "bg-severity-critical/20", text: "text-severity-critical", label: "CRITICAL" },
  high: { bg: "bg-severity-high/20", text: "text-severity-high", label: "HIGH" },
  medium: { bg: "bg-severity-medium/20", text: "text-severity-medium", label: "MEDIUM" },
  low: { bg: "bg-severity-low/20", text: "text-severity-low", label: "LOW" },
  info: { bg: "bg-severity-info/20", text: "text-severity-info", label: "INFO" },
};

export const NarrativePanel: React.FC<Props> = ({
  narrative,
  severity,
  progress,
  presentationMode = false,
}) => {
  const badge = severityBadge[severity];
  const showTech = progress > 0.3;
  const showRoot = progress > 0.5;
  const showActions = progress > 0.7;
  const prefersReducedMotion = usePrefersReducedMotion();
  const revealClassName = prefersReducedMotion ? "" : "animate-fade-in-up";
  const titleId = "incident-narrative-title";

  return (
    <section className={`glass-panel flex h-full flex-col overflow-y-auto scrollbar-thin ${presentationMode ? "p-5" : "p-4"}`} aria-labelledby={titleId}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <h3 id={titleId} className={`font-heading uppercase tracking-widest text-muted-foreground ${presentationMode ? "text-sm" : "text-xs"}`}>Incident Narrative</h3>
        </div>
        <div className={`${badge.bg} ${badge.text} px-2 py-0.5 rounded-sm font-mono font-bold ${presentationMode ? "text-xs" : "text-[10px]"}`}>
          {badge.label}
        </div>
      </div>

      {/* Impact Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className={`font-mono text-muted-foreground uppercase tracking-wider ${presentationMode ? "text-xs" : "text-[10px]"}`}>Impact Score</span>
          <span className={`font-mono text-sm font-bold ${
            narrative.impactScore >= 80 ? "text-severity-critical" :
            narrative.impactScore >= 50 ? "text-severity-high" :
            "text-severity-medium"
          }`}>
            {Math.round(narrative.impactScore * progress)}
          </span>
        </div>
        <div
          className="h-1.5 bg-secondary rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Incident impact score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(narrative.impactScore * progress)}
        >
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
      <div className={`mb-4 ${revealClassName}`}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Shield className="h-3 w-3 text-primary" />
          <span className={`font-heading uppercase tracking-wider text-primary ${presentationMode ? "text-xs" : "text-[10px]"}`}>Executive Summary</span>
        </div>
        <p className={`${presentationMode ? "text-sm" : "text-xs"} text-foreground/80 leading-relaxed`}>{narrative.executiveSummary}</p>
      </div>

      {/* Technical Summary */}
      {showTech && (
        <div className={`mb-4 ${revealClassName}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target className="h-3 w-3 text-severity-info" />
            <span className={`font-heading uppercase tracking-wider text-severity-info ${presentationMode ? "text-xs" : "text-[10px]"}`}>Technical Analysis</span>
          </div>
          <p className={`${presentationMode ? "text-sm" : "text-xs"} text-foreground/70 leading-relaxed`}>{narrative.technicalSummary}</p>
        </div>
      )}

      {/* Root Cause */}
      {showRoot && (
        <div className={`mb-4 ${revealClassName}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertTriangle className="h-3 w-3 text-severity-high" />
            <span className={`font-heading uppercase tracking-wider text-severity-high ${presentationMode ? "text-xs" : "text-[10px]"}`}>Root Cause</span>
          </div>
          <p className={`${presentationMode ? "text-sm" : "text-xs"} text-foreground/70 leading-relaxed`}>{narrative.rootCause}</p>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className={revealClassName}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 className="h-3 w-3 text-severity-low" />
            <span className={`font-heading uppercase tracking-wider text-severity-low ${presentationMode ? "text-xs" : "text-[10px]"}`}>Recommended Actions</span>
          </div>
          <ul className="space-y-1">
            {narrative.actions.map((action, i) => (
              <li key={i} className={`flex items-start gap-2 text-foreground/70 ${presentationMode ? "text-sm" : "text-xs"}`}>
                <span className={`font-mono text-muted-foreground mt-0.5 ${presentationMode ? "text-xs" : "text-[10px]"}`}>{(i + 1).toString().padStart(2, "0")}</span>
                <span className="leading-relaxed">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {progress === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className={`text-muted-foreground font-mono ${presentationMode ? "text-sm" : "text-xs"}`} role="status">Narrative reveals as incident unfolds...</p>
        </div>
      )}
    </section>
  );
};
