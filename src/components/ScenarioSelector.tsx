import React from "react";
import type { Scenario, Severity } from "@/data/scenarios";
import { Activity, Shield, Zap } from "lucide-react";

interface Props {
  scenarios: Scenario[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  customScenarioIds?: string[];
  metadataByScenarioId?: Map<
    string,
    {
      origin: "builtin" | "custom";
      versionCount: number;
      currentRevision: number;
      published: boolean;
      publishedRevision: number | null;
      snapshotCount: number;
      latestSnapshotAt: string | null;
    }
  >;
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

export const ScenarioSelector: React.FC<Props> = ({
  scenarios,
  activeId,
  onSelect,
  onDelete,
  customScenarioIds = [],
  metadataByScenarioId,
}) => {
  return (
    <section className="space-y-2" aria-labelledby="scenario-selector-title">
      <div className="flex items-center gap-2 px-2 mb-3">
        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
        <h2 id="scenario-selector-title" className="font-heading text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Scenarios</h2>
      </div>
      <ul className="space-y-2" role="list">
      {scenarios.map((s, i) => {
        const Icon = icons[i % icons.length];
        const active = s.id === activeId;
        const isCustom = customScenarioIds.includes(s.id);
        const metadata = metadataByScenarioId?.get(s.id);
        return (
          <li key={s.id} className="relative group">
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              aria-current={active ? "page" : undefined}
              aria-label={`${s.name}, ${s.severity} severity, ${s.events.length} events, duration ${Math.floor(s.duration / 60)} minutes ${s.duration % 60} seconds`}
              className={`focus-ring w-full text-left p-3 rounded-lg transition-all border ${
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
                  {metadata && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span className="rounded-full bg-secondary/70 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                        {metadata.origin}
                      </span>
                      {metadata.origin === "custom" && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-primary">
                          r{metadata.currentRevision} • {metadata.versionCount} versions
                        </span>
                      )}
                      {metadata.published && metadata.publishedRevision && (
                        <span className="rounded-full bg-severity-low/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-severity-low">
                          live r{metadata.publishedRevision}
                        </span>
                      )}
                      {metadata.snapshotCount > 0 && (
                        <span className="rounded-full bg-secondary/70 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                          {metadata.snapshotCount} snapshots
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
            {isCustom && onDelete && (
              <button
                type="button"
                aria-label={`Delete custom scenario ${s.name}`}
                onClick={() => onDelete(s.id)}
                className="focus-ring absolute right-2 top-2 text-xs text-destructive opacity-0 transition-opacity hover:text-destructive/80 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                style={{ zIndex: 2 }}
              >
                ×
              </button>
            )}
          </li>
        );
      })}
      </ul>
    </section>
  );
};
