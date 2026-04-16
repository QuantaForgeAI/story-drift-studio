import type { Scenario } from "@/data/scenarios";
import { parseScenarioCollection } from "@/lib/scenarioSchema";

const CUSTOM_SCENARIOS_STORAGE_KEY = "story-drift-studio/custom-scenarios/v1";
const ACTIVE_SCENARIO_ID_STORAGE_KEY = "story-drift-studio/active-scenario-id/v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveStorage(storage?: StorageLike) {
  if (storage) return storage;
  if (typeof window === "undefined" || !window.localStorage) {
    throw new Error("Local storage is unavailable in this environment.");
  }

  return window.localStorage;
}

export function loadStoredCustomScenarios(storage?: StorageLike): Scenario[] {
  const safeStorage = resolveStorage(storage);
  const raw = safeStorage.getItem(CUSTOM_SCENARIOS_STORAGE_KEY);
  if (!raw) return [];

  return parseScenarioCollection(JSON.parse(raw));
}

export function saveStoredCustomScenarios(scenarios: Scenario[], storage?: StorageLike) {
  const safeStorage = resolveStorage(storage);
  const normalized = parseScenarioCollection(scenarios);
  safeStorage.setItem(CUSTOM_SCENARIOS_STORAGE_KEY, JSON.stringify(normalized));
}

export function loadStoredActiveScenarioId(storage?: StorageLike) {
  const safeStorage = resolveStorage(storage);
  return safeStorage.getItem(ACTIVE_SCENARIO_ID_STORAGE_KEY);
}

export function saveStoredActiveScenarioId(activeScenarioId: string, storage?: StorageLike) {
  const safeStorage = resolveStorage(storage);
  safeStorage.setItem(ACTIVE_SCENARIO_ID_STORAGE_KEY, activeScenarioId);
}

export function clearStoredScenarioWorkspace(storage?: StorageLike) {
  const safeStorage = resolveStorage(storage);
  safeStorage.removeItem(CUSTOM_SCENARIOS_STORAGE_KEY);
  safeStorage.removeItem(ACTIVE_SCENARIO_ID_STORAGE_KEY);
}
