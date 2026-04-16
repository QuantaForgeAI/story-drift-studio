import { useState, useCallback, useRef, useEffect } from "react";
import type { Scenario, TimelineEvent, TopologyNode } from "@/data/scenarios";
import {
  getNextTimelineTime,
  getTimelineSnapshot,
} from "@/lib/simulation-core";

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

  const updateTime = useCallback(
    (time: number) => {
      const sc = scenarioRef.current;
      if (!sc) return;
      const snapshot = getTimelineSnapshot(sc, time);
      setState((prev) => ({
        ...prev,
        currentTime: snapshot.currentTime,
        activeEvents: snapshot.activeEvents,
        currentEvent: snapshot.currentEvent,
        nodeStates: snapshot.nodeStates,
      }));
    },
    []
  );

  const play = useCallback(() => {
    const sc = scenarioRef.current;
    if (!sc) return;

    setState((prev) => {
      const shouldRestart = prev.currentTime >= sc.duration;
      const snapshot = getTimelineSnapshot(sc, shouldRestart ? 0 : prev.currentTime);
      return {
        ...prev,
        currentTime: snapshot.currentTime,
        activeEvents: snapshot.activeEvents,
        currentEvent: snapshot.currentEvent,
        nodeStates: snapshot.nodeStates,
        isPlaying: true,
      };
    });
  }, []);

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

          const nextTime = getNextTimelineTime(prev.currentTime, prev.speed, sc.duration);
          const snapshot = getTimelineSnapshot(sc, nextTime);

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
  }, [state.isPlaying, scenario]);

  // Reset when scenario changes
  useEffect(() => {
    reset();
    if (scenario) updateTime(0);
  }, [scenario, reset, updateTime]);

  return { ...state, play, pause, seek, setSpeed, reset };
}
