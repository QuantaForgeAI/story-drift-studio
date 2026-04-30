import React from "react";
import { ScrollText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScenarioAuditActivityList } from "@/components/ScenarioAuditActivityList";
import type { ScenarioAuditEvent } from "@/lib/scenarioWorkspace";

interface ScenarioAuditLogDialogProps {
  auditLog: ScenarioAuditEvent[];
  scenarioId: string;
  scenarioName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScenarioAuditLogDialog({
  auditLog,
  scenarioId,
  scenarioName,
  open,
  onOpenChange,
}: ScenarioAuditLogDialogProps) {
  const scenarioEvents = React.useMemo(
    () =>
      auditLog
        .filter((event) => event.scenarioId === scenarioId)
        .slice()
        .reverse(),
    [auditLog, scenarioId],
  );
  const workspaceEvents = React.useMemo(() => auditLog.slice().reverse(), [auditLog]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-border/60 bg-background/95 p-0 shadow-2xl">
        <div className="border-b border-border/50 bg-gradient-to-br from-cyan-500/10 via-background to-blue-500/10 px-6 py-5">
          <DialogHeader className="text-left">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
              <ScrollText className="h-4 w-4" />
            </div>
            <DialogTitle>Audit trail</DialogTitle>
            <DialogDescription>
              Review who changed what, which revision was affected, and how playback or snapshot activity moved through the simulator.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs defaultValue="scenario" className="p-6 pt-5">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/40">
            <TabsTrigger value="scenario" className="text-xs">
              Current scenario
            </TabsTrigger>
            <TabsTrigger value="workspace" className="text-xs">
              Workspace-wide
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scenario">
            <ScrollArea className="h-[420px] pr-4">
              <div className="pb-4">
                <ScenarioAuditActivityList
                  events={scenarioEvents}
                  emptyMessage={`No audit events recorded yet for ${scenarioName}.`}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="workspace">
            <ScrollArea className="h-[420px] pr-4">
              <div className="pb-4">
                <ScenarioAuditActivityList
                  events={workspaceEvents}
                  emptyMessage="No workspace-wide audit events recorded yet."
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
