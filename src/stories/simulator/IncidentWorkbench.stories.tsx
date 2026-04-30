import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { Scenario } from "@/data/scenarios";
import { NarrativePanel } from "@/components/NarrativePanel";
import { StatusBar } from "@/components/StatusBar";
import { TimelinePanel } from "@/components/TimelinePanel";
import { TopologyMap } from "@/components/TopologyMap";
import { getTimelineSnapshot } from "@/lib/simulation-core";
import { getScenarioFixture } from "@/stories/storybook-fixtures";

interface IncidentWorkbenchStoryProps {
  scenarioId: Scenario["id"];
  time: number;
}

function IncidentWorkbenchStory({
  scenarioId,
  time,
}: IncidentWorkbenchStoryProps) {
  const scenario = React.useMemo(() => getScenarioFixture(scenarioId), [scenarioId]);
  const snapshot = React.useMemo(
    () => getTimelineSnapshot(scenario, time),
    [scenario, time],
  );

  return (
    <div className="mx-auto grid max-w-[1480px] gap-4">
      <StatusBar
        currentTime={snapshot.currentTime}
        duration={scenario.duration}
        eventsTriggered={snapshot.activeEvents.length}
        totalEvents={scenario.events.length}
        severity={scenario.severity}
        scenarioName={scenario.name}
      />

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="h-[560px]">
            <TopologyMap
              nodes={scenario.nodes}
              edges={scenario.edges}
              nodeStates={snapshot.nodeStates}
              affectedNodes={snapshot.currentEvent?.affectedNodes ?? []}
            />
          </div>

          <div className="h-[560px]">
            <TimelinePanel
              scenario={scenario}
              currentTime={snapshot.currentTime}
              isPlaying={snapshot.currentTime > 0 && !snapshot.isComplete}
              speed={3}
              activeEvents={snapshot.activeEvents}
              onPlay={() => undefined}
              onPause={() => undefined}
              onSeek={() => undefined}
              onSpeedChange={() => undefined}
              onReset={() => undefined}
            />
          </div>
        </div>

        <div className="h-[560px]">
          <NarrativePanel
            narrative={scenario.narrative}
            severity={scenario.severity}
            progress={snapshot.progress}
          />
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "Simulator/Incident Workbench",
  component: IncidentWorkbenchStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    scenarioId: {
      control: "select",
      options: ["supply-chain-attack", "k8s-drift-cascade", "iam-privilege-escalation"],
    },
    time: {
      control: {
        type: "range",
        min: 0,
        max: 180,
        step: 5,
      },
    },
  },
} satisfies Meta<typeof IncidentWorkbenchStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActivePrivilegeEscalation: Story = {
  args: {
    scenarioId: "iam-privilege-escalation",
    time: 100,
  },
};

export const PostRecoveryReview: Story = {
  args: {
    scenarioId: "supply-chain-attack",
    time: 180,
  },
};
