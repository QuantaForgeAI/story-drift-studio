import React from "react";
import type { Scenario, Severity } from "@/data/scenarios";
import { Activity, Shield, Zap } from "lucide-react";

interface Props {
  scenarios: Scenario[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

const severityColor: Record<Severity, string> = {
  critical: "text-severity-critical",
  high: "text-severity-high",
  medium: "text-severity-medium",
  low: "text-severity-low",
  info: "text-severity-info",
};

const severityBg: Record<Severity, string> = {
  critical: "bg-severity-critical/10",
  high: "bg-severity-high/10",
  medium: "bg-severity-medium/10",
  low: "bg-severity-low/10",
  info: "bg-severity-info/10",
};

const icons = [Shield, Activity, Zap];

export const ScenarioSelector: React.FC<Props> = ({ scenarios, activeId, onSelect }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-2 mb-3">
        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Scenarios</span>
      </div>
      {scenarios.map((s, i) => {
        const Icon = icons[i % icons.length];
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left p-3 rounded-lg transition-all border ${
              active
                ? "glass-panel-elevated border-primary/30 neon-glow"
                : "border-transparent hover:bg-secondary/50"
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className={`p-1.5 rounded-md ${severityBg[s.severity]} mt-0.5`}>
                <Icon className={`h-3.5 w-3.5 ${severityColor[s.severity]}`} />
              </div>
              <div className="min-w-0">
                <h4 className="font-heading text-xs text-foreground truncate">{s.name}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{s.subtitle}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`font-mono text-[9px] font-bold ${severityColor[s.severity]}`}>
                    {s.severity.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-mono">{s.events.length} events</span>
                  <span className="text-[9px] text-muted-foreground font-mono">{Math.floor(s.duration / 60)}m{s.duration % 60}s</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
