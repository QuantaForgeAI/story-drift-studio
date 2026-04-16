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
import { Radar, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [customScenarios, setCustomScenarios] = useState<Scenario[]>([]);
  const allScenarios = useMemo(() => [...builtInScenarios, ...customScenarios], [customScenarios]);

  const [activeScenarioId, setActiveScenarioId] = useState<string>(builtInScenarios[0].id);
  const [showBuilder, setShowBuilder] = useState(false);

  const scenario = useMemo(() => allScenarios.find((s) => s.id === activeScenarioId) ?? allScenarios[0], [activeScenarioId, allScenarios]);

  const timeline = useTimelineEngine(scenario);

  const affectedNodes = timeline.currentEvent?.affectedNodes ?? [];
  const progress = scenario.duration > 0 ? timeline.currentTime / scenario.duration : 0;

  const handleSaveScenario = (newScenario: Scenario) => {
    setCustomScenarios((prev) => [...prev, newScenario]);
    setActiveScenarioId(newScenario.id);
    setShowBuilder(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-3 flex items-center justify-between bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Radar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-sm tracking-wide text-foreground">SYSTEM DRIFT SIMULATOR</h1>
            <p className="text-[10px] text-muted-foreground font-mono tracking-wider">INCIDENT MODELING & REPLAY ENGINE</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span className="hidden sm:inline">v1.0.0</span>
          <div className="h-3 w-px bg-border" />
          <span className="hidden sm:inline">{allScenarios.length} SCENARIOS LOADED</span>
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
        {/* Sidebar - Scenario Selector or Builder */}
        <aside className="w-64 flex-shrink-0 overflow-y-auto scrollbar-thin flex flex-col">
          {showBuilder ? (
            <ScenarioBuilder onSave={handleSaveScenario} onClose={() => setShowBuilder(false)} />
          ) : (
            <>
              <ScenarioSelector
                scenarios={allScenarios}
                activeId={activeScenarioId}
                onSelect={(id) => setActiveScenarioId(id)}
              />
              <Button
                variant="ghost"
                className="mt-3 w-full text-xs gap-1.5 border border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all"
                onClick={() => setShowBuilder(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Build Custom Scenario
              </Button>
            </>
          )}
        </aside>

        {/* Center - Topology + Timeline */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="flex-1 min-h-0">
            <TopologyMap
              nodes={scenario.nodes}
              edges={scenario.edges}
              nodeStates={timeline.nodeStates}
              affectedNodes={affectedNodes}
            />
          </div>
          <div className="h-[320px] flex-shrink-0">
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
          </div>
        </div>

        {/* Right Panel - Narrative */}
        <aside className="w-80 flex-shrink-0">
          <NarrativePanel narrative={scenario.narrative} severity={scenario.severity} progress={progress} />
        </aside>
      </div>
    </div>
  );
};

export default Index;
