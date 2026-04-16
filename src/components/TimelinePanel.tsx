import React from "react";
import { Play, Pause, RotateCcw, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Scenario, TimelineEvent, Severity } from "@/data/scenarios";

interface Props {
  scenario: Scenario;
  currentTime: number;
  isPlaying: boolean;
  speed: number;
  activeEvents: TimelineEvent[];
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  onReset: () => void;
}

const severityDot: Record<Severity, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
  info: "bg-severity-info",
};

const typeLabel: Record<TimelineEvent["type"], string> = {
  drift: "DRIFT",
  alert: "ALERT",
  failure: "FAILURE",
  recovery: "RECOVERY",
  injection: "INJECT",
  cascade: "CASCADE",
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export const TimelinePanel: React.FC<Props> = ({
  scenario,
  currentTime,
  isPlaying,
  speed,
  activeEvents,
  onPlay,
  onPause,
  onSeek,
  onSpeedChange,
  onReset,
}) => {
  return (
    <div className="glass-panel p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-severity-high animate-pulse" />
          <h3 className="font-heading text-xs uppercase tracking-widest text-muted-foreground">Timeline</h3>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {formatTime(currentTime)} / {formatTime(scenario.duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={isPlaying ? onPause : onPlay}>
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onSpeedChange(speed >= 5 ? 1 : speed + 1)}
        >
          <FastForward className="h-3.5 w-3.5" />
        </Button>
        <span className="font-mono text-[10px] text-muted-foreground">{speed}×</span>
        <div className="flex-1 ml-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={scenario.duration}
            step={1}
            onValueChange={([v]) => onSeek(v)}
            className="cursor-pointer"
          />
        </div>
      </div>

      {/* Event markers on timeline */}
      <div className="relative h-4 mb-3 rounded-sm bg-secondary/50">
        {scenario.events.map((evt) => (
          <button
            key={evt.id}
            className={`absolute top-0 h-4 w-1 rounded-full cursor-pointer transition-opacity hover:opacity-100 ${
              evt.timestamp <= currentTime ? severityDot[evt.severity] : "bg-muted-foreground/30"
            }`}
            style={{ left: `${(evt.timestamp / scenario.duration) * 100}%` }}
            onClick={() => onSeek(evt.timestamp)}
            title={evt.title}
          />
        ))}
        {/* Playhead */}
        <div
          className="absolute top-0 h-4 w-0.5 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
          style={{ left: `${(currentTime / scenario.duration) * 100}%`, transition: "left 0.3s" }}
        />
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5 min-h-0">
        {activeEvents.map((evt, i) => (
          <div
            key={evt.id}
            className={`flex gap-2 p-2 rounded-md text-xs transition-all ${
              i === activeEvents.length - 1
                ? "glass-panel-elevated border-l-2 border-l-primary animate-fade-in-up"
                : "opacity-60"
            }`}
          >
            <div className={`h-2 w-2 mt-1 rounded-full flex-shrink-0 ${severityDot[evt.severity]}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[10px] text-muted-foreground">{formatTime(evt.timestamp)}</span>
                <span className={`font-mono text-[10px] font-bold ${
                  evt.severity === "critical" ? "text-severity-critical" :
                  evt.severity === "high" ? "text-severity-high" :
                  "text-muted-foreground"
                }`}>
                  {typeLabel[evt.type]}
                </span>
              </div>
              <p className="font-body text-foreground/90 leading-snug">{evt.title}</p>
              {i === activeEvents.length - 1 && (
                <p className="text-muted-foreground mt-1 leading-relaxed">{evt.description}</p>
              )}
              {i === activeEvents.length - 1 && evt.stateDiff && (
                <div className="mt-1.5 space-y-0.5">
                  {evt.stateDiff.map((d, di) => (
                    <div key={di} className="font-mono text-[10px] flex gap-1 flex-wrap">
                      <span className="text-muted-foreground">{d.field}:</span>
                      <span className="text-severity-critical line-through">{d.before}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-severity-high">{d.after}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {activeEvents.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-8 font-mono">
            Press play to begin simulation...
          </div>
        )}
      </div>
    </div>
  );
};
