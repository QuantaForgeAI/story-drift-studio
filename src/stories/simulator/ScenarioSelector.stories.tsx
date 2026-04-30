import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { Scenario } from "@/data/scenarios";
import { ScenarioSelector } from "@/components/ScenarioSelector";
import { getScenarioFixture } from "@/stories/storybook-fixtures";

function buildSelectorScenarios() {
  const builtin = [
    getScenarioFixture("supply-chain-attack"),
    getScenarioFixture("k8s-drift-cascade"),
    getScenarioFixture("iam-privilege-escalation"),
  ];
  const imported = getScenarioFixture("k8s-drift-cascade");

  imported.id = "custom-k8s-checkout";
  imported.name = "Checkout Edge Failover";
  imported.subtitle = "Imported from Kubernetes manifests with custom revisions and replay snapshots";

  return [...builtin, imported];
}

interface ScenarioSelectorStoryProps {
  initialActiveId: string;
}

function ScenarioSelectorStory({ initialActiveId }: ScenarioSelectorStoryProps) {
  const scenarios = React.useMemo(() => buildSelectorScenarios(), []);
  const [activeId, setActiveId] = React.useState(initialActiveId);
  const metadataByScenarioId = React.useMemo(
    () =>
      new Map<
        string,
        {
          origin: "builtin" | "custom";
          versionCount: number;
          currentRevision: number;
          published: boolean;
          publishedRevision: number | null;
          snapshotCount: number;
          latestSnapshotAt: string | null;
        }
      >([
        [
          "supply-chain-attack",
          {
            origin: "builtin",
            versionCount: 1,
            currentRevision: 1,
            published: true,
            publishedRevision: 1,
            snapshotCount: 2,
            latestSnapshotAt: "2026-04-24T13:15:00.000Z",
          },
        ],
        [
          "k8s-drift-cascade",
          {
            origin: "builtin",
            versionCount: 1,
            currentRevision: 1,
            published: true,
            publishedRevision: 1,
            snapshotCount: 1,
            latestSnapshotAt: "2026-04-24T13:25:00.000Z",
          },
        ],
        [
          "iam-privilege-escalation",
          {
            origin: "builtin",
            versionCount: 1,
            currentRevision: 1,
            published: true,
            publishedRevision: 1,
            snapshotCount: 3,
            latestSnapshotAt: "2026-04-24T13:40:00.000Z",
          },
        ],
        [
          "custom-k8s-checkout",
          {
            origin: "custom",
            versionCount: 4,
            currentRevision: 4,
            published: true,
            publishedRevision: 3,
            snapshotCount: 6,
            latestSnapshotAt: "2026-04-24T13:55:00.000Z",
          },
        ],
      ]),
    [],
  );

  return (
    <div className="mx-auto max-w-md">
      <ScenarioSelector
        scenarios={scenarios as Scenario[]}
        activeId={activeId}
        onSelect={setActiveId}
        onDelete={() => undefined}
        customScenarioIds={["custom-k8s-checkout"]}
        metadataByScenarioId={metadataByScenarioId}
      />
    </div>
  );
}

const meta = {
  title: "Simulator/Scenario Selector",
  component: ScenarioSelectorStory,
  tags: ["autodocs"],
  args: {
    initialActiveId: "custom-k8s-checkout",
  },
} satisfies Meta<typeof ScenarioSelectorStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MixedCatalog: Story = {};
