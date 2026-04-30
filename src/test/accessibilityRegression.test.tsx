import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScenarioBuilder } from "@/components/ScenarioBuilder";
import { ScenarioPresentationPanel } from "@/components/ScenarioPresentationPanel";
import { ScenarioSelector } from "@/components/ScenarioSelector";
import { TimelinePanel } from "@/components/TimelinePanel";
import { TopologyMap } from "@/components/TopologyMap";
import { scenarios as builtInScenarios } from "@/data/scenarios";
import { MotionPreferenceProvider } from "@/hooks/usePrefersReducedMotion";
import { buildScenarioPresentationBookmarks } from "@/lib/scenarioPresentation";

describe("accessibility regression coverage", () => {
  it("keeps impacted node pulse animations available in reduced-motion mode", () => {
    const originalMatchMedia = window.matchMedia;

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    try {
      const { container } = render(
        <TopologyMap
          nodes={[
            {
              id: "cdn",
              label: "CDN",
              type: "external",
              x: 100,
              y: 100,
              status: "down",
            },
          ]}
          edges={[]}
          nodeStates={new Map([["cdn", "down"]])}
          affectedNodes={["cdn"]}
        />,
      );

      const pulseAnimations = Array.from(container.querySelectorAll("animate")).filter(
        (element) =>
          element.getAttribute("attributeName") === "opacity" &&
          element.getAttribute("repeatCount") === "indefinite",
      );

      expect(pulseAnimations.length).toBeGreaterThan(0);
      expect(container.querySelector("animateMotion")).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("allows a full-motion override even when the system prefers reduced motion", () => {
    const originalMatchMedia = window.matchMedia;

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    try {
      const { container } = render(
        <MotionPreferenceProvider mode="full">
          <TopologyMap
            nodes={[
              {
                id: "edge-client",
                label: "Client",
                type: "client",
                x: 80,
                y: 100,
                status: "down",
              },
              {
                id: "edge-api",
                label: "API",
                type: "service",
                x: 240,
                y: 100,
                status: "healthy",
              },
            ]}
            edges={[{ from: "edge-client", to: "edge-api" }]}
            nodeStates={
              new Map([
                ["edge-client", "down"],
                ["edge-api", "healthy"],
              ])
            }
            affectedNodes={["edge-client"]}
          />
        </MotionPreferenceProvider>,
      );

      expect(container.querySelector("animateMotion")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("supports keyboard repositioning for editable topology nodes", () => {
    const onNodePositionChange = vi.fn();

    render(
      <TopologyMap
        nodes={[
          {
            id: "api",
            label: "API Gateway",
            type: "service",
            x: 100,
            y: 100,
            status: "healthy",
          },
        ]}
        edges={[]}
        nodeStates={new Map([["api", "healthy"]])}
        affectedNodes={[]}
        onNodePositionChange={onNodePositionChange}
      />,
    );

    const nodeButton = screen.getByRole("button", { name: /api gateway/i });
    fireEvent.focus(nodeButton);
    fireEvent.keyDown(nodeButton, { key: "ArrowRight" });

    expect(onNodePositionChange).toHaveBeenCalledWith("api", 108, 100);
  });

  it("exposes labelled playback controls and event jump buttons", () => {
    render(
      <TimelinePanel
        scenario={builtInScenarios[0]}
        currentTime={0}
        isPlaying={false}
        speed={1}
        activeEvents={[]}
        onPlay={() => undefined}
        onPause={() => undefined}
        onSeek={() => undefined}
        onSpeedChange={() => undefined}
        onReset={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: /play simulation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("slider", { name: /simulation timeline position/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /jump timeline to this event/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders labelled builder fields and navigation controls", () => {
    render(<ScenarioBuilder onSave={() => undefined} onClose={() => undefined} />);

    expect(screen.getByLabelText(/scenario name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/duration \(seconds\)/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /close scenario builder/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /1 scenario/i }),
    ).toHaveAttribute("aria-current", "step");
  });

  it("provides accessible labels for scenario selection and deletion", () => {
    const scenario = builtInScenarios[0];

    render(
      <ScenarioSelector
        scenarios={[scenario]}
        activeId={scenario.id}
        onSelect={() => undefined}
        onDelete={() => undefined}
        customScenarioIds={[scenario.id]}
      />,
    );

    expect(
      screen.getAllByRole("button", { name: new RegExp(scenario.name, "i") })[0],
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("button", {
        name: new RegExp(`delete custom scenario ${scenario.name}`, "i"),
      }),
    ).toBeInTheDocument();
  });

  it("renders accessible presenter controls and bookmark navigation", () => {
    const scenario = builtInScenarios[2];
    const bookmarks = buildScenarioPresentationBookmarks(scenario);

    render(
      <ScenarioPresentationPanel
        scenario={scenario}
        currentTime={75}
        bookmarks={bookmarks}
        selectedBookmarkId={bookmarks[1]?.id ?? bookmarks[0]?.id ?? null}
        presenterMode
        focusPanel="split"
        showSpeakerNotes
        onSelectBookmark={() => undefined}
        onTogglePresenterMode={() => undefined}
        onFocusChange={() => undefined}
        onToggleSpeakerNotes={() => undefined}
        onCopyShareLink={() => undefined}
        onOpenShortcuts={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: /exit presenter mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /copy demo link/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /shortcuts/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(4);
  });
});
