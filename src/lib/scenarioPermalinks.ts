import type { Scenario } from "@/data/scenarios";
import { parseScenario } from "@/lib/scenarioSchema";
import type { PresentationFocusPanel } from "@/lib/scenarioPresentation";
import { parsePresentationFocusPanel } from "@/lib/scenarioPresentation";

export const SCENARIO_REVISION_SEARCH_PARAM = "revision";
export const SCENARIO_SNAPSHOT_SEARCH_PARAM = "snapshot";
export const SCENARIO_PRESENTATION_SEARCH_PARAM = "present";
export const SCENARIO_PRESENTATION_TIME_SEARCH_PARAM = "t";
export const SCENARIO_PRESENTATION_FOCUS_SEARCH_PARAM = "focus";
export const SCENARIO_PRESENTATION_BOOKMARK_SEARCH_PARAM = "bookmark";

function toUrlSafeBase64(base64: string) {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromUrlSafeBase64(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;

  if (padding === 0) return base64;

  return `${base64}${"=".repeat(4 - padding)}`;
}

function encodeUtf8ToBase64(value: string) {
  if (typeof window === "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary);
}

function decodeUtf8FromBase64(base64: string) {
  if (typeof window === "undefined") {
    return Buffer.from(base64, "base64").toString("utf8");
  }

  const binary = window.atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function buildScenarioPath(scenarioId: string) {
  return `/scenarios/${encodeURIComponent(scenarioId)}`;
}

export function encodeScenarioSnapshot(scenario: Scenario) {
  const normalizedScenario = parseScenario(scenario);
  return toUrlSafeBase64(encodeUtf8ToBase64(JSON.stringify(normalizedScenario)));
}

export function decodeScenarioSnapshot(snapshot: string) {
  return parseScenario(JSON.parse(decodeUtf8FromBase64(fromUrlSafeBase64(snapshot))));
}

interface SharePathOptions {
  revision?: number | null;
  includeSnapshot?: boolean;
  presentation?: {
    presenterMode?: boolean;
    currentTime?: number | null;
    focusPanel?: PresentationFocusPanel;
    bookmarkId?: string | null;
  };
}

export function buildScenarioSharePath(
  scenario: Scenario,
  options: SharePathOptions = {},
) {
  const searchParams = new URLSearchParams();
  if (options.revision) {
    searchParams.set(SCENARIO_REVISION_SEARCH_PARAM, String(options.revision));
  }

  if (options.includeSnapshot) {
    searchParams.set(
      SCENARIO_SNAPSHOT_SEARCH_PARAM,
      encodeScenarioSnapshot(scenario),
    );
  }

  if (options.presentation?.presenterMode) {
    searchParams.set(SCENARIO_PRESENTATION_SEARCH_PARAM, "1");
  }

  if (
    options.presentation?.currentTime != null &&
    Number.isFinite(options.presentation.currentTime) &&
    options.presentation.currentTime > 0
  ) {
    searchParams.set(
      SCENARIO_PRESENTATION_TIME_SEARCH_PARAM,
      String(Math.round(options.presentation.currentTime)),
    );
  }

  if (
    options.presentation?.focusPanel &&
    options.presentation.focusPanel !== "split"
  ) {
    searchParams.set(
      SCENARIO_PRESENTATION_FOCUS_SEARCH_PARAM,
      options.presentation.focusPanel,
    );
  }

  if (options.presentation?.bookmarkId) {
    searchParams.set(
      SCENARIO_PRESENTATION_BOOKMARK_SEARCH_PARAM,
      options.presentation.bookmarkId,
    );
  }

  const search = searchParams.toString();
  return `${buildScenarioPath(scenario.id)}${search ? `?${search}` : ""}`;
}

function parsePresentationTime(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function parseScenarioPresentationState(searchParams: URLSearchParams) {
  return {
    presenterMode:
      searchParams.get(SCENARIO_PRESENTATION_SEARCH_PARAM) === "1",
    currentTime: parsePresentationTime(
      searchParams.get(SCENARIO_PRESENTATION_TIME_SEARCH_PARAM),
    ),
    focusPanel: parsePresentationFocusPanel(
      searchParams.get(SCENARIO_PRESENTATION_FOCUS_SEARCH_PARAM),
    ),
    bookmarkId:
      searchParams.get(SCENARIO_PRESENTATION_BOOKMARK_SEARCH_PARAM) ?? null,
  };
}
