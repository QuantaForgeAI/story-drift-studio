import { useState, useCallback, useRef, useEffect } from "react";
import type { Scenario, TimelineEvent, TopologyNode } from "@/data/scenarios";

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

  const computeNodeStates = useCallback(
    (time: number, sc: Scenario): Map<string, TopologyNode["status"]> => {
      const states = new Map<string, TopologyNode["status"]>();
      sc.nodes.forEach((n) => states.set(n.id, "healthy"));

      const past = sc.events.filter((e) => e.timestamp <= time);
      for (const evt of past) {
        for (const nodeId of evt.affectedNodes) {
          if (evt.type === "failure" || evt.type === "cascade") states.set(nodeId, "down");
          else if (evt.type === "alert" || evt.type === "injection" || evt.type === "drift") {
            if (states.get(nodeId) !== "down") states.set(nodeId, "degraded");
          } else if (evt.type === "recovery") states.set(nodeId, "healthy");
        }
      }
      return states;
    },
    []
  );

  const updateTime = useCallback(
    (time: number) => {
      const sc = scenarioRef.current;
      if (!sc) return;
      const clamped = Math.min(Math.max(0, time), sc.duration);
      const active = sc.events.filter((e) => e.timestamp <= clamped);
      const current = [...active].reverse().find((e) => e.timestamp <= clamped) || null;
      const nodeStates = computeNodeStates(clamped, sc);
      setState((prev) => ({
        ...prev,
        currentTime: clamped,
        activeEvents: active,
        currentEvent: current,
        nodeStates,
      }));
    },
    [computeNodeStates]
  );

  const play = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: true }));
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
          const next = prev.currentTime + prev.speed;
          if (next >= (scenarioRef.current?.duration ?? 0)) {
            return { ...prev, isPlaying: false };
          }
          return prev; // actual update in the next effect
        });
        // Update outside
        setState((prev) => {
          if (!prev.isPlaying) return prev;
          const next = prev.currentTime + prev.speed;
          const sc = scenarioRef.current!;
          const clamped = Math.min(next, sc.duration);
          const active = sc.events.filter((e) => e.timestamp <= clamped);
          const current = [...active].reverse().find((e) => e.timestamp <= clamped) || null;
          const nodeStates = computeNodeStates(clamped, sc);
          const done = clamped >= sc.duration;
          return { ...prev, currentTime: clamped, activeEvents: active, currentEvent: current, nodeStates, isPlaying: !done };
        });
      }, 1000);
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state.isPlaying, scenario, computeNodeStates]);

  // Reset when scenario changes
  useEffect(() => {
    reset();
    if (scenario) updateTime(0);
  }, [scenario?.id]);

  return { ...state, play, pause, seek, setSpeed, reset };
}
