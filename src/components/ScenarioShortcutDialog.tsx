import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { keys: ["Space", "K"], description: "Play or pause playback" },
  { keys: ["Left", "P"], description: "Jump to the previous event" },
  { keys: ["Right", "N"], description: "Jump to the next event" },
  { keys: ["R"], description: "Reset to the start" },
  { keys: ["F"], description: "Toggle presenter mode" },
  { keys: ["1", "2", "3", "4"], description: "Switch split, topology, timeline, or narrative focus" },
  { keys: ["?"], description: "Open or close this shortcut reference" },
];

export function ScenarioShortcutDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Presentation Shortcuts</DialogTitle>
          <DialogDescription>
            Keyboard controls for demos and workshops.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.description}
              className="flex flex-col gap-2 rounded-lg border border-border/50 bg-secondary/20 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-wrap gap-2">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded-md border border-border/60 bg-background px-2 py-1 font-mono text-[11px] text-foreground"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground sm:max-w-[70%] sm:text-right">
                {shortcut.description}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
