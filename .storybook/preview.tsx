import React from "react";
import type { Preview } from "@storybook/react";
import { MotionPreferenceProvider } from "@/hooks/usePrefersReducedMotion";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/index.css";

const preview: Preview = {
  parameters: {
    actions: {
      argTypesRegex: "^on[A-Z].*",
    },
    backgrounds: {
      default: "war-room",
      values: [
        { name: "war-room", value: "hsl(240 50% 4%)" },
        { name: "elevated", value: "hsl(240 42% 10%)" },
        { name: "paper", value: "hsl(0 0% 100%)" },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "padded",
    options: {
      storySort: {
        order: ["Design System", "Simulator"],
      },
    },
  },
  globalTypes: {
    motionMode: {
      name: "Motion",
      description: "Simulator motion mode",
      defaultValue: "system",
      toolbar: {
        icon: "transfer",
        items: [
          { value: "system", title: "System default" },
          { value: "reduced", title: "Reduced motion" },
          { value: "full", title: "Full motion" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const motionMode = context.globals.motionMode ?? "system";

      return (
        <MotionPreferenceProvider mode={motionMode}>
          <TooltipProvider>
            <div className="min-h-screen bg-background p-6 text-foreground antialiased">
              <Story />
            </div>
          </TooltipProvider>
        </MotionPreferenceProvider>
      );
    },
  ],
};

export default preview;
