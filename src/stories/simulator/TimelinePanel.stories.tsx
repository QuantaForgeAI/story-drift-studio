import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { Scenario } from "@/data/scenarios";
import { TimelinePanel } from "@/components/TimelinePanel";
import { getTimelineSnapshot } from "@/lib/simulation-core";
import { getScenarioFixture } from "@/stories/storybook-fixtures";

interface TimelinePanelStoryProps {
  scenarioId: Scenario["id"];
  initialTime: number;
  initialSpeed: number;
  initialPlaying?: boolean;
}

function TimelinePanelStory({
  scenarioId,
  initialTime,
  initialSpeed,
  initialPlaying = false,
}: TimelinePanelStoryProps) {
  const scenario = React.useMemo(() => getScenarioFixture(scenarioId), [scenarioId]);
  const [currentTime, setCurrentTime] = React.useState(initialTime);
  const [speed, setSpeed] = React.useState(initialSpeed);
  const [isPlaying, setIsPlaying] = React.useState(initialPlaying);

  React.useEffect(() => {
    setCurrentTime(initialTime);
  }, [initialTime]);

  React.useEffect(() => {
    setSpeed(initialSpeed);
  }, [initialSpeed]);

  React.useEffect(() => {
    setIsPlaying(initialPlaying);
  }, [initialPlaying]);

  const snapshot = React.useMemo(
    () => getTimelineSnapshot(scenario, currentTime),
    [scenario, currentTime],
  );

  return (
    <div className="mx-auto h-[620px] max-w-[420px]">
      <TimelinePanel
        scenario={scenario}
        currentTime={currentTime}
        isPlaying={isPlaying}
        speed={speed}
        activeEvents={snapshot.activeEvents}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onSeek={setCurrentTime}
        onSpeedChange={setSpeed}
        onReset={() => {
          setCurrentTime(0);
          setIsPlaying(false);
          setSpeed(initialSpeed);
        }}
      />
    </div>
  );
}

const meta = {
  title: "Simulator/Timeline Panel",
  component: TimelinePanelStory,
  tags: ["autodocs"],
  args: {
    initialPlaying: false,
    initialSpeed: 2,
  },
  argTypes: {
    scenarioId: {
      control: "select",
      options: ["supply-chain-attack", "k8s-drift-cascade", "iam-privilege-escalation"],
    },
    initialTime: {
      control: {
        type: "range",
        min: 0,
        max: 180,
        step: 5,
      },
    },
    initialSpeed: {
      control: {
        type: "range",
        min: 1,
        max: 5,
        step: 1,
      },
    },
  },
} satisfies Meta<typeof TimelinePanelStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standby: Story = {
  args: {
    scenarioId: "supply-chain-attack",
    initialTime: 0,
  },
};

export const MidIncident: Story = {
  args: {
    scenarioId: "iam-privilege-escalation",
    initialTime: 100,
    initialPlaying: true,
    initialSpeed: 3,
  },
};

export const RecoveryWindow: Story = {
  args: {
    scenarioId: "k8s-drift-cascade",
    initialTime: 130,
    initialSpeed: 1,
  },
};
