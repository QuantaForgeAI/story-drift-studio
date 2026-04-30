import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ScenarioPresentationPanel } from "@/components/ScenarioPresentationPanel";
import { getScenarioFixture } from "@/stories/storybook-fixtures";
import { buildScenarioPresentationBookmarks } from "@/lib/scenarioPresentation";

const scenario = getScenarioFixture("iam-privilege-escalation");
const bookmarks = buildScenarioPresentationBookmarks(scenario);

const meta = {
  title: "Simulator/Presentation Console",
  component: ScenarioPresentationPanel,
  tags: ["autodocs"],
  render: (args) => (
    <div className="mx-auto max-w-6xl">
      <ScenarioPresentationPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof ScenarioPresentationPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WorkspaceMode: Story = {
  args: {
    scenario,
    currentTime: 0,
    bookmarks,
    selectedBookmarkId: bookmarks[0]?.id ?? null,
    presenterMode: false,
    focusPanel: "split",
    showSpeakerNotes: false,
    onSelectBookmark: fn(),
    onTogglePresenterMode: fn(),
    onFocusChange: fn(),
    onToggleSpeakerNotes: fn(),
    onCopyShareLink: fn(),
    onOpenShortcuts: fn(),
  },
};

export const PresenterMode: Story = {
  args: {
    ...WorkspaceMode.args,
    currentTime: 100,
    selectedBookmarkId: bookmarks[2]?.id ?? bookmarks[0]?.id ?? null,
    presenterMode: true,
    focusPanel: "topology",
    showSpeakerNotes: true,
  },
};
