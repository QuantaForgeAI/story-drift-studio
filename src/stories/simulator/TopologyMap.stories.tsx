import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { Scenario } from "@/data/scenarios";
import { TopologyMap } from "@/components/TopologyMap";
import { getTimelineSnapshot } from "@/lib/simulation-core";
import { getScenarioFixture } from "@/stories/storybook-fixtures";

interface TopologyMapStoryProps {
  scenarioId: Scenario["id"];
  time: number;
  editable?: boolean;
}

function TopologyMapStory({ scenarioId, time, editable = false }: TopologyMapStoryProps) {
  const baseScenario = React.useMemo(() => getScenarioFixture(scenarioId), [scenarioId]);
  const [nodes, setNodes] = React.useState(baseScenario.nodes);

  React.useEffect(() => {
    setNodes(baseScenario.nodes);
  }, [baseScenario]);

  const scenario = React.useMemo(
    () => ({
      ...baseScenario,
      nodes,
    }),
    [baseScenario, nodes],
  );
  const snapshot = React.useMemo(
    () => getTimelineSnapshot(scenario, time),
    [scenario, time],
  );

  return (
    <div className="mx-auto h-[460px] max-w-5xl">
      <TopologyMap
        nodes={nodes}
        edges={scenario.edges}
        nodeStates={snapshot.nodeStates}
        affectedNodes={snapshot.currentEvent?.affectedNodes ?? []}
        activeEvents={snapshot.activeEvents}
        currentEvent={snapshot.currentEvent}
        onNodePositionChange={
          editable
            ? (id, x, y) => {
                setNodes((currentNodes) =>
                  currentNodes.map((node) =>
                    node.id === id ? { ...node, x, y } : node,
                  ),
                );
              }
            : undefined
        }
      />
    </div>
  );
}

const meta = {
  title: "Simulator/Topology Map",
  component: TopologyMapStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    editable: false,
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
} satisfies Meta<typeof TopologyMapStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HealthyBaseline: Story = {
  args: {
    scenarioId: "k8s-drift-cascade",
    time: 0,
  },
};

export const FailureCascade: Story = {
  args: {
    scenarioId: "supply-chain-attack",
    time: 120,
  },
};

export const EditableReview: Story = {
  args: {
    scenarioId: "iam-privilege-escalation",
    time: 75,
    editable: true,
  },
};
