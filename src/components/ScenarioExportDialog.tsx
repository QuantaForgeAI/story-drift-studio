import { Braces, FileText, Link2, ScrollText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ScenarioRichExportKind } from "@/lib/scenarioExportArtifacts";

interface ExportOption {
  kind: ScenarioRichExportKind;
  title: string;
  description: string;
  icon: typeof FileText;
  disabled?: boolean;
  disabledReason?: string;
}

interface ScenarioExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioName: string;
  canSharePlaybackLink: boolean;
  busyKind?: ScenarioRichExportKind | null;
  onSelect: (kind: ScenarioRichExportKind) => void;
}

export function ScenarioExportDialog({
  open,
  onOpenChange,
  scenarioName,
  canSharePlaybackLink,
  busyKind = null,
  onSelect,
}: ScenarioExportDialogProps) {
  const options: ExportOption[] = [
    {
      kind: "scenario-json",
      title: "Scenario JSON",
      description: "Download the structured scenario definition for reuse and re-import.",
      icon: Braces,
    },
    {
      kind: "incident-report",
      title: "Incident Report",
      description: "Export a markdown report with the scenario summary, topology, and timeline.",
      icon: FileText,
    },
    {
      kind: "postmortem",
      title: "Postmortem",
      description: "Export a markdown postmortem with root cause, audit trail, and replay history.",
      icon: ScrollText,
    },
    {
      kind: "playback-brief",
      title: "Playback Brief",
      description: "Export a stakeholder-ready markdown brief with the playback link and presenter notes.",
      icon: Link2,
      disabled: !canSharePlaybackLink,
      disabledReason: "This role cannot generate stakeholder playback links.",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Scenario Package</DialogTitle>
          <DialogDescription>
            Choose how to export <span className="font-medium text-foreground">{scenarioName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          {options.map((option) => {
            const Icon = option.icon;
            const isBusy = busyKind === option.kind;

            return (
              <button
                key={option.kind}
                type="button"
                className="rounded-xl border border-border/60 bg-card/70 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => onSelect(option.kind)}
                disabled={option.disabled || busyKind != null}
                title={option.disabled ? option.disabledReason : option.description}
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg border border-border/60 bg-background/80 p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{option.title}</p>
                      {isBusy ? (
                        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          exporting
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {option.disabled && option.disabledReason
                        ? option.disabledReason
                        : option.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busyKind != null}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
