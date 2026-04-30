import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { ScenarioBuilder } from "@/components/ScenarioBuilder";

const meta = {
  title: "Simulator/Scenario Builder",
  component: ScenarioBuilder,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    onSave: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof ScenarioBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  render: (args) => (
    <div className="mx-auto h-[920px] max-w-6xl p-6">
      <ScenarioBuilder {...args} />
    </div>
  ),
};

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile2",
    },
  },
  render: (args) => (
    <div className="mx-auto h-[920px] max-w-md p-4">
      <ScenarioBuilder {...args} />
    </div>
  ),
};
