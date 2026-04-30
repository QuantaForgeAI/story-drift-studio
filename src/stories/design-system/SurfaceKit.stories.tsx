import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { AlertTriangle, Play, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

function TimelineControlPreview() {
  const [value, setValue] = React.useState([88]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>Timeline position</span>
        <span>{value[0]}s</span>
      </div>
      <Slider
        value={value}
        min={0}
        max={180}
        step={1}
        onValueChange={setValue}
        thumbAriaLabel="Timeline preview position"
        thumbAriaValueText={`${value[0]} seconds`}
      />
    </div>
  );
}

const meta = {
  title: "Design System/Surface Kit",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Controls: Story = {
  render: () => (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Action Controls</CardTitle>
          <CardDescription>
            Primary, secondary, and destructive actions used across the simulator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button className="gap-2">
              <Play className="h-4 w-4" />
              Replay incident
            </Button>
            <Button variant="secondary">Publish revision</Button>
            <Button variant="outline" className="gap-2">
              <Share2 className="h-4 w-4" />
              Copy share link
            </Button>
            <Button variant="destructive" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Archive scenario
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="default" variant="secondary">
              Default
            </Button>
            <Button size="lg" variant="outline">
              Large
            </Button>
            <Button size="icon" variant="ghost" aria-label="Play">
              <Play className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg">Status Tokens</CardTitle>
          <CardDescription>
            Severity badges and timeline controls used in incident playback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <Badge>Live</Badge>
            <Badge variant="secondary">Draft</Badge>
            <Badge variant="outline">Snapshot</Badge>
            <Badge variant="destructive">Critical</Badge>
          </div>
          <TimelineControlPreview />
        </CardContent>
      </Card>
    </div>
  ),
};
