import React, { useState, useMemo } from "react";
import { scenarios as builtInScenarios } from "@/data/scenarios";
import type { Scenario } from "@/data/scenarios";
import { useTimelineEngine } from "@/hooks/useTimelineEngine";
import { TopologyMap } from "@/components/TopologyMap";
import { TimelinePanel } from "@/components/TimelinePanel";
import { NarrativePanel } from "@/components/NarrativePanel";
import { ScenarioSelector } from "@/components/ScenarioSelector";
import { ScenarioBuilder } from "@/components/ScenarioBuilder";
import { StatusBar } from "@/components/StatusBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Network, Plus, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportScenario, importScenario } from "@/lib/scenarioIO";
import {
  clearStoredScenarioWorkspace,
  loadStoredActiveScenarioId,
  loadStoredCustomScenarios,
  saveStoredActiveScenarioId,
  saveStoredCustomScenarios,
} from "@/lib/scenarioStorage";
import { toast } from "@/components/ui/sonner";

function loadScenarioWorkspace() {
  try {
    return {
      customScenarios: loadStoredCustomScenarios(),
      activeScenarioId: loadStoredActiveScenarioId(),
      error: null as string | null,
    };
  } catch (error) {
    console.error("Failed to hydrate stored scenario workspace", error);
    try {
      clearStoredScenarioWorkspace();
    } catch (clearError) {
      console.error("Failed to clear corrupted scenario workspace", clearError);
    }

    return {
      customScenarios: [] as Scenario[],
      activeScenarioId: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const Index = () => {
  const initialWorkspace = useMemo(() => loadScenarioWorkspace(), []);
  const [customScenarios, setCustomScenarios] = useState<Scenario[]>(initialWorkspace.customScenarios);
  const allScenarios = useMemo(() => [...builtInScenarios, ...customScenarios], [customScenarios]);

  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    initialWorkspace.activeScenarioId ?? builtInScenarios[0].id
  );
  const [showBuilder, setShowBuilder] = useState(false);

  const [scenarioState, setScenarioState] = useState<Scenario | null>(null);
  // Always use scenarioState if it matches, otherwise use the selected scenario
  const scenario = useMemo(() => {
    if (scenarioState && scenarioState.id === activeScenarioId) return scenarioState;
    return allScenarios.find((s) => s.id === activeScenarioId) ?? allScenarios[0];
  }, [activeScenarioId, allScenarios, scenarioState]);

  // Reset scenarioState when switching scenarios
  React.useEffect(() => {
    const found = allScenarios.find((s) => s.id === activeScenarioId) ?? allScenarios[0];
    if (found.id !== activeScenarioId) {
      setActiveScenarioId(found.id);
      return;
    }
    setScenarioState(found);
  }, [activeScenarioId, allScenarios]);

  React.useEffect(() => {
    if (!initialWorkspace.error) return;
    toast.error("Stored scenarios were reset", {
      description: initialWorkspace.error,
    });
  }, [initialWorkspace.error]);

  React.useEffect(() => {
    try {
      saveStoredCustomScenarios(customScenarios);
    } catch (error) {
      console.error("Failed to persist custom scenarios", error);
      toast.error("Could not save custom scenarios", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [customScenarios]);

  React.useEffect(() => {
    try {
      saveStoredActiveScenarioId(activeScenarioId);
    } catch (error) {
      console.error("Failed to persist active scenario", error);
      toast.error("Could not save active scenario", {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [activeScenarioId]);

  // Update node position handler
  const handleNodePositionChange = (id: string, x: number, y: number) => {
    setScenarioState((prev) => {
      const base = prev && prev.id === scenario.id ? prev : { ...scenario };
      return {
        ...base,
        nodes: base.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      };
    });

    setCustomScenarios((prev) =>
      prev.map((item) =>
        item.id === activeScenarioId
          ? {
              ...item,
              nodes: item.nodes.map((node) => (node.id === id ? { ...node, x, y } : node)),
            }
          : item,
      ),
    );
  };

  const timeline = useTimelineEngine(scenario);

  const affectedNodes = timeline.currentEvent?.affectedNodes ?? [];
  const progress = scenario.duration > 0 ? timeline.currentTime / scenario.duration : 0;


  const handleSaveScenario = (newScenario: Scenario) => {
    setCustomScenarios((prev) => [...prev, newScenario]);
    setActiveScenarioId(newScenario.id);
    setShowBuilder(false);
    toast.success("Scenario saved", {
      description: `${newScenario.name} is now available in your workspace.`,
    });
  };

  const handleDeleteScenario = (id: string) => {
    const deletedScenario = customScenarios.find((scenario) => scenario.id === id);
    setCustomScenarios((prev) => prev.filter((s) => s.id !== id));
    if (activeScenarioId === id) {
      setActiveScenarioId(builtInScenarios[0].id);
    }
    toast.success("Custom scenario deleted", {
      description: deletedScenario?.name ?? "The scenario was removed from your workspace.",
    });
  };

  const handleExportScenario = () => {
    exportScenario(scenario);
    toast.success("Scenario exported", {
      description: `${scenario.name} was downloaded as JSON.`,
    });
  };

  const handleImportScenario = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importScenario(file)
      .then((imported) => {
        setCustomScenarios((prev) => [...prev, imported]);
        setActiveScenarioId(imported.id);
        toast.success("Scenario imported", {
          description: `${imported.name} was added to your workspace.`,
        });
      })
      .catch((err) => {
        console.error(err);
        toast.error("Import failed", {
          description: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        e.target.value = "";
      });
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-3 flex items-center justify-between bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative p-2 rounded-lg bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-cyan-500/20 border border-blue-400/30 shadow-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-transparent to-purple-400/10 animate-pulse"></div>
            <Network className="h-6 w-6 text-blue-600 relative z-10 drop-shadow-sm" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75"></div>
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full"></div>
          </div>
          <div>
            <h1 className="font-heading text-sm tracking-wide text-foreground">SYSTEM DRIFT SIMULATOR</h1>
            <p className="text-[10px] text-muted-foreground font-mono tracking-wider">INCIDENT MODELING & REPLAY ENGINE</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleExportScenario}
            title="Export current scenario"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => fileInputRef.current?.click()}
            title="Import scenario JSON"
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportScenario}
          />
          <div className="h-3 w-px bg-border" />
          <span className="text-[10px] font-mono text-muted-foreground">
            v1.0.0
          </span>
        </div>
      </header>

      {/* Status Bar */}
      <div className="px-4 pt-3">
        <StatusBar
          currentTime={timeline.currentTime}
          duration={scenario.duration}
          eventsTriggered={timeline.activeEvents.length}
          totalEvents={scenario.events.length}
          severity={scenario.severity}
          scenarioName={scenario.name}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-3 p-4 min-h-0">
        {/* Sidebar - Scenario Selector */}
        <aside className="w-64 flex-shrink-0 overflow-y-auto scrollbar-thin flex flex-col">
          <ErrorBoundary
            title="Scenario workspace failed"
            description="The scenario list hit an unexpected error. Retry this panel to recover your workspace."
            resetKeys={[activeScenarioId, allScenarios.length]}
          >
            <ScenarioSelector
              scenarios={allScenarios}
              activeId={activeScenarioId}
              onSelect={(id) => setActiveScenarioId(id)}
              onDelete={handleDeleteScenario}
              customScenarioIds={customScenarios.map((scenario) => scenario.id)}
            />
            <Button
              variant="ghost"
              className="mt-3 w-full text-xs gap-1.5 border border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all"
              onClick={() => setShowBuilder(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Build Custom Scenario
            </Button>
          </ErrorBoundary>
        </aside>

        {/* Scenario Builder Modal */}
        <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Build Custom Scenario</DialogTitle>
            </DialogHeader>
            <ScenarioBuilder onSave={handleSaveScenario} onClose={() => setShowBuilder(false)} />
          </DialogContent>
        </Dialog>

        {/* Center - Topology + Timeline */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex-1 min-h-0">
            <ErrorBoundary
              title="Topology renderer failed"
              description="The topology visualization crashed. Retry the panel or switch scenarios to continue."
              resetKeys={[scenario.id, scenarioState?.nodes.length ?? scenario.nodes.length]}
            >
              <TopologyMap
                nodes={scenarioState ? scenarioState.nodes : scenario.nodes}
                edges={scenario.edges}
                nodeStates={timeline.nodeStates}
                affectedNodes={affectedNodes}
                onNodePositionChange={handleNodePositionChange}
              />
            </ErrorBoundary>
          </div>
          <div className="h-[320px] flex-shrink-0">
            <ErrorBoundary
              title="Timeline panel failed"
              description="The playback controls encountered an error. Retry the panel to resume the simulation."
              resetKeys={[scenario.id, timeline.currentTime]}
            >
              <TimelinePanel
                scenario={scenario}
                currentTime={timeline.currentTime}
                isPlaying={timeline.isPlaying}
                speed={timeline.speed}
                activeEvents={timeline.activeEvents}
                onPlay={timeline.play}
                onPause={timeline.pause}
                onSeek={timeline.seek}
                onSpeedChange={timeline.setSpeed}
                onReset={timeline.reset}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Right Panel - Narrative */}
        <aside className="w-80 flex-shrink-0">
          <ErrorBoundary
            title="Narrative panel failed"
            description="The incident narrative could not be rendered. Retry the panel to continue reviewing the scenario."
            resetKeys={[scenario.id, timeline.currentTime]}
          >
            <NarrativePanel narrative={scenario.narrative} severity={scenario.severity} progress={progress} />
          </ErrorBoundary>
        </aside>
      </div>
    </div>
  );
};

export default Index;
