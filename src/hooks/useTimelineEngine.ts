import { useState, useCallback, useRef, useEffect } from "react";
import type { Scenario, TimelineEvent, TopologyNode } from "@/data/scenarios";
import {
  getNextTimelineTime,
  getTimelineSnapshot,
} from "@/lib/simulation-core";
import { recordTelemetrySample } from "@/lib/scenarioObservability";

export interface TimelineState {
  currentTime: number;
  isPlaying: boolean;
  speed: number;
  activeEvents: TimelineEvent[];
  currentEvent: TimelineEvent | null;
  nodeStates: Map<string, TopologyNode["status"]>;
}

export function useTimelineEngine(scenario: Scenario | null) {
  const [state, setState] = useState<TimelineState>({
    currentTime: 0,
    isPlaying: false,
    speed: 1,
    activeEvents: [],
    currentEvent: null,
    nodeStates: new Map(),
  });

  const intervalRef = useRef<number | null>(null);
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;
  const lastSampledEventCountRef = useRef<number | null>(null);

  const recordSimulationTelemetry = useCallback(
    (
      name: string,
      startedAt: number,
      details?: Record<string, unknown>,
    ) => {
      const sc = scenarioRef.current;
      recordTelemetrySample({
        source: "client",
        scope: "simulation",
        name,
        value:
          (typeof performance !== "undefined" && typeof performance.now === "function"
            ? performance.now()
            : Date.now()) - startedAt,
        unit: "ms",
        scenarioId: sc?.id ?? null,
        scenarioName: sc?.name ?? null,
        details,
        notify: false,
      });
    },
    [],
  );

  const updateTime = useCallback(
    (time: number) => {
      const sc = scenarioRef.current;
      if (!sc) return;
      const startedAt =
        typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now();
      const snapshot = getTimelineSnapshot(sc, time);
      recordSimulationTelemetry("simulation.seek_compute", startedAt, {
        targetTime: snapshot.currentTime,
        activeEventCount: snapshot.activeEvents.length,
        currentEventId: snapshot.currentEvent?.id ?? null,
      });
      setState((prev) => ({
        ...prev,
        currentTime: snapshot.currentTime,
        activeEvents: snapshot.activeEvents,
        currentEvent: snapshot.currentEvent,
        nodeStates: snapshot.nodeStates,
      }));
    },
    [recordSimulationTelemetry]
  );

  const play = useCallback(() => {
    const sc = scenarioRef.current;
    if (!sc) return;
    const startedAt =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();

    setState((prev) => {
      const shouldRestart = prev.currentTime >= sc.duration;
      const snapshot = getTimelineSnapshot(sc, shouldRestart ? 0 : prev.currentTime);
      recordSimulationTelemetry("simulation.play_start_compute", startedAt, {
        restarted: shouldRestart,
        activeEventCount: snapshot.activeEvents.length,
      });
      return {
        ...prev,
        currentTime: snapshot.currentTime,
        activeEvents: snapshot.activeEvents,
        currentEvent: snapshot.currentEvent,
        nodeStates: snapshot.nodeStates,
        isPlaying: true,
      };
    });
  }, [recordSimulationTelemetry]);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const seek = useCallback(
    (time: number) => {
      updateTime(time);
    },
    [updateTime]
  );

  const setSpeed = useCallback((speed: number) => {
    setState((prev) => ({ ...prev, speed }));
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false, currentTime: 0, activeEvents: [], currentEvent: null, nodeStates: new Map() }));
  }, []);

  // Playback loop
  useEffect(() => {
    if (state.isPlaying && scenario) {
      intervalRef.current = window.setInterval(() => {
        setState((prev) => {
          const sc = scenarioRef.current;
          if (!prev.isPlaying || !sc) return prev;

          const startedAt =
            typeof performance !== "undefined" && typeof performance.now === "function"
              ? performance.now()
              : Date.now();
          const nextTime = getNextTimelineTime(prev.currentTime, prev.speed, sc.duration);
          const snapshot = getTimelineSnapshot(sc, nextTime);
          const shouldSample =
            lastSampledEventCountRef.current == null ||
            lastSampledEventCountRef.current !== snapshot.activeEvents.length ||
            snapshot.isComplete;

          if (shouldSample) {
            lastSampledEventCountRef.current = snapshot.activeEvents.length;
            recordSimulationTelemetry("simulation.tick_compute", startedAt, {
              currentTime: snapshot.currentTime,
              activeEventCount: snapshot.activeEvents.length,
              isComplete: snapshot.isComplete,
            });
          }

          return {
            ...prev,
            currentTime: snapshot.currentTime,
            activeEvents: snapshot.activeEvents,
            currentEvent: snapshot.currentEvent,
            nodeStates: snapshot.nodeStates,
            isPlaying: !snapshot.isComplete,
          };
        });
      }, 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [recordSimulationTelemetry, state.isPlaying, scenario]);

  // Reset when scenario changes
  useEffect(() => {
    reset();
    lastSampledEventCountRef.current = null;
    if (scenario) updateTime(0);
  }, [scenario, reset, updateTime]);

  return { ...state, play, pause, seek, setSpeed, reset };
}
