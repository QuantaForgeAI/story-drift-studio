import React from "react";
import { Play, Pause, RotateCcw, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Scenario, TimelineEvent, Severity } from "@/data/scenarios";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

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
  onPreviousEvent?: () => void;
  onNextEvent?: () => void;
  presentationMode?: boolean;
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
  onPreviousEvent,
  onNextEvent,
  presentationMode = false,
}) => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const titleId = "timeline-panel-title";

  return (
    <section className={`glass-panel flex h-full flex-col ${presentationMode ? "p-5" : "p-4"}`} aria-labelledby={titleId}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full bg-severity-high ${prefersReducedMotion ? "" : "animate-pulse"}`} />
          <h3 id={titleId} className={`font-heading uppercase tracking-widest text-muted-foreground ${presentationMode ? "text-sm" : "text-xs"}`}>Timeline</h3>
        </div>
        <span className={`font-mono text-muted-foreground ${presentationMode ? "text-sm" : "text-xs"}`}>
          {formatTime(currentTime)} / {formatTime(scenario.duration)}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size={presentationMode ? "sm" : "icon"} className={presentationMode ? "h-8 px-3 text-xs" : "h-7 w-7"} onClick={onReset} aria-label="Reset simulation to the start">
          <RotateCcw className="h-3.5 w-3.5" />
          {presentationMode ? <span>Reset</span> : null}
        </Button>
        <Button
          variant="ghost"
          size={presentationMode ? "sm" : "icon"}
          className={presentationMode ? "h-8 px-3 text-xs" : "h-7 w-7"}
          onClick={isPlaying ? onPause : onPlay}
          aria-label={isPlaying ? "Pause simulation playback" : "Play simulation"}
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {presentationMode ? <span>{isPlaying ? "Pause" : "Play"}</span> : null}
        </Button>
        {onPreviousEvent ? (
          <Button
            variant="ghost"
            size={presentationMode ? "sm" : "icon"}
            className={presentationMode ? "h-8 px-3 text-xs" : "h-7 w-7"}
            onClick={onPreviousEvent}
            aria-label="Jump to previous scenario event"
          >
            <span className="font-mono">Prev</span>
          </Button>
        ) : null}
        {onNextEvent ? (
          <Button
            variant="ghost"
            size={presentationMode ? "sm" : "icon"}
            className={presentationMode ? "h-8 px-3 text-xs" : "h-7 w-7"}
            onClick={onNextEvent}
            aria-label="Jump to next scenario event"
          >
            <span className="font-mono">Next</span>
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size={presentationMode ? "sm" : "icon"}
          className={presentationMode ? "h-8 px-3 text-xs" : "h-7 w-7"}
          onClick={() => onSpeedChange(speed >= 5 ? 1 : speed + 1)}
          aria-label={`Playback speed ${speed}x. Activate to switch to ${speed >= 5 ? 1 : speed + 1}x.`}
        >
          <FastForward className="h-3.5 w-3.5" />
          {presentationMode ? <span>{speed}x</span> : null}
        </Button>
        {!presentationMode ? (
          <span className="font-mono text-[10px] text-muted-foreground">{speed}×</span>
        ) : null}
        <div className="flex-1 ml-2">
          <Slider
            value={[currentTime]}
            min={0}
            max={scenario.duration}
            step={1}
            onValueChange={([v]) => onSeek(v)}
            className="cursor-pointer"
            thumbAriaLabel="Simulation timeline position"
            thumbAriaValueText={`${formatTime(currentTime)} elapsed of ${formatTime(scenario.duration)}`}
          />
        </div>
      </div>

      {/* Event markers on timeline */}
      <div className="relative h-4 mb-3 rounded-sm bg-secondary/50" aria-label="Scenario event markers">
        {scenario.events.map((evt) => (
          <button
            key={evt.id}
            type="button"
            className={`focus-ring absolute top-0 h-4 w-1 rounded-full cursor-pointer transition-opacity hover:opacity-100 ${
              evt.timestamp <= currentTime ? severityDot[evt.severity] : "bg-muted-foreground/30"
            }`}
            style={{ left: `${(evt.timestamp / scenario.duration) * 100}%` }}
            onClick={() => onSeek(evt.timestamp)}
            title={evt.title}
            aria-label={`${typeLabel[evt.type]} ${evt.severity} event at ${formatTime(evt.timestamp)}: ${evt.title || "Untitled event"}. Jump timeline to this event.`}
          />
        ))}
        {/* Playhead */}
        <div
          className="absolute top-0 h-4 w-0.5 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
          style={{
            left: `${(currentTime / scenario.duration) * 100}%`,
            transition: prefersReducedMotion ? undefined : "left 0.3s",
          }}
        />
      </div>

      {/* Event log */}
      <ol className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5 min-h-0" aria-label="Triggered timeline events">
        {activeEvents.map((evt, i) => (
          <li
            key={evt.id}
            className={`flex gap-2 rounded-md transition-all ${
              presentationMode ? "p-3 text-sm" : "p-2 text-xs"
            } ${
              i === activeEvents.length - 1
                ? "glass-panel-elevated border-l-2 border-l-primary animate-fade-in-up"
                : "opacity-60"
            }`}
          >
            <div className={`h-2 w-2 mt-1 rounded-full flex-shrink-0 ${severityDot[evt.severity]}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`font-mono text-muted-foreground ${presentationMode ? "text-xs" : "text-[10px]"}`}>{formatTime(evt.timestamp)}</span>
                <span className={`font-mono font-bold ${presentationMode ? "text-xs" : "text-[10px]"} ${
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
                    <div key={di} className={`font-mono flex gap-1 flex-wrap ${presentationMode ? "text-xs" : "text-[10px]"}`}>
                      <span className="text-muted-foreground">{d.field}:</span>
                      <span className="text-severity-critical line-through">{d.before}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-severity-high">{d.after}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
        {activeEvents.length === 0 && (
          <li className={`py-8 text-center font-mono text-muted-foreground ${presentationMode ? "text-sm" : "text-xs"}`} role="status">
            Press play to begin simulation...
          </li>
        )}
      </ol>
    </section>
  );
};
