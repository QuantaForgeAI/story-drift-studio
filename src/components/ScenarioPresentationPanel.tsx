import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Scenario } from "@/data/scenarios";
import {
  formatPresentationTimestamp,
  getPresentationBookmarkById,
  presentationFocusLabels,
  presentationFocusPanelValues,
  type PresentationFocusPanel,
  type ScenarioPresentationBookmark,
} from "@/lib/scenarioPresentation";

interface Props {
  scenario: Scenario;
  currentTime: number;
  bookmarks: ScenarioPresentationBookmark[];
  selectedBookmarkId: string | null;
  presenterMode: boolean;
  focusPanel: PresentationFocusPanel;
  showSpeakerNotes: boolean;
  onSelectBookmark: (bookmark: ScenarioPresentationBookmark) => void;
  onTogglePresenterMode: () => void;
  onFocusChange: (focusPanel: PresentationFocusPanel) => void;
  onToggleSpeakerNotes: () => void;
  onCopyShareLink: () => void;
  onOpenShortcuts: () => void;
}

const kindBadgeClasses: Record<ScenarioPresentationBookmark["kind"], string> = {
  overview: "border-primary/30 bg-primary/10 text-primary",
  signal: "border-severity-info/30 bg-severity-info/10 text-severity-info",
  failure:
    "border-severity-critical/30 bg-severity-critical/10 text-severity-critical",
  recovery: "border-severity-low/30 bg-severity-low/10 text-severity-low",
  debrief:
    "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
};

export function ScenarioPresentationPanel({
  scenario,
  currentTime,
  bookmarks,
  selectedBookmarkId,
  presenterMode,
  focusPanel,
  showSpeakerNotes,
  onSelectBookmark,
  onTogglePresenterMode,
  onFocusChange,
  onToggleSpeakerNotes,
  onCopyShareLink,
  onOpenShortcuts,
}: Props) {
  const selectedBookmark =
    getPresentationBookmarkById(bookmarks, selectedBookmarkId) ?? bookmarks[0] ?? null;

  return (
    <section
      className={`glass-panel space-y-4 border-border/60 p-4 ${
        presenterMode ? "glass-panel-elevated shadow-xl shadow-black/20" : ""
      }`}
      aria-labelledby="presentation-console-title"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <h2
              id="presentation-console-title"
              className="font-heading text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
            >
              Presentation Console
            </h2>
            <Badge
              variant="outline"
              className={
                presenterMode
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/50 bg-secondary/40 text-muted-foreground"
              }
            >
              {presenterMode ? "Presenter mode" : "Workspace mode"}
            </Badge>
          </div>
          <div>
            <p className="font-heading text-sm text-foreground">{scenario.name}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Bookmarks, notes, and view focus for demo playback.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={presenterMode ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={onTogglePresenterMode}
            aria-label={presenterMode ? "Exit presenter mode" : "Enter presenter mode"}
          >
            {presenterMode ? "Exit presenter" : "Presenter mode"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={onToggleSpeakerNotes}
          >
            {showSpeakerNotes ? "Hide notes" : "Show notes"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={onCopyShareLink}
            aria-label="Copy demo link"
          >
            Copy link
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={onOpenShortcuts}
          >
            Shortcuts
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Presentation focus presets">
        {presentationFocusPanelValues.map((panel) => (
          <Button
            key={panel}
            variant={panel === focusPanel ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => onFocusChange(panel)}
            aria-pressed={panel === focusPanel}
          >
            {presentationFocusLabels[panel]}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="font-heading text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Demo Bookmarks
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            Current time {formatPresentationTimestamp(currentTime)}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {bookmarks.map((bookmark) => {
            const isSelected = bookmark.id === selectedBookmarkId;

            return (
              <button
                key={bookmark.id}
                type="button"
                onClick={() => onSelectBookmark(bookmark)}
                className={`focus-ring min-w-[180px] rounded-lg border px-3 py-2 text-left transition-all ${
                  isSelected
                    ? "border-primary/40 bg-primary/10 shadow-sm shadow-primary/10"
                    : "border-border/50 bg-secondary/20 hover:border-border hover:bg-secondary/35"
                }`}
                aria-pressed={isSelected}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                    {formatPresentationTimestamp(bookmark.time)}
                  </span>
                  <Badge
                    variant="outline"
                    className={`px-1.5 py-0 text-[9px] ${kindBadgeClasses[bookmark.kind]}`}
                  >
                    {bookmark.kind}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground">
                  {bookmark.label}
                </p>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  {bookmark.summary}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {selectedBookmark ? (
        <div className="grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-heading text-sm text-foreground">
                {selectedBookmark.title}
              </p>
              <Badge
                variant="outline"
                className={`px-2 py-0.5 text-[10px] ${kindBadgeClasses[selectedBookmark.kind]}`}
              >
                {selectedBookmark.kind}
              </Badge>
              <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                Focus: {presentationFocusLabels[selectedBookmark.focus]}
              </Badge>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">
              {selectedBookmark.summary}
            </p>
          </div>

          <div className="rounded-xl border border-border/50 bg-background/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Speaker Notes
              </p>
              <span className="font-mono text-[10px] text-muted-foreground">
                {showSpeakerNotes ? "visible" : "hidden"}
              </span>
            </div>
            {showSpeakerNotes ? (
              <ol className="mt-3 space-y-2">
                {selectedBookmark.speakerNotes.map((note, index) => (
                  <li
                    key={`${selectedBookmark.id}-${index}`}
                    className="flex gap-2 text-[12px] leading-relaxed text-foreground/80"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {(index + 1).toString().padStart(2, "0")}
                    </span>
                    <span>{note}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Notes are hidden.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
