import type { Scenario, Severity, TimelineEvent } from "@/data/scenarios";

export const presentationFocusPanelValues = [
  "split",
  "topology",
  "timeline",
  "narrative",
] as const;

export type PresentationFocusPanel =
  (typeof presentationFocusPanelValues)[number];

export const presentationFocusLabels: Record<
  PresentationFocusPanel,
  string
> = {
  split: "Split view",
  topology: "Topology",
  timeline: "Timeline",
  narrative: "Narrative",
};

export interface ScenarioPresentationBookmark {
  id: string;
  time: number;
  title: string;
  label: string;
  summary: string;
  severity: Severity;
  focus: PresentationFocusPanel;
  speakerNotes: string[];
  eventId: string | null;
  kind: "overview" | "signal" | "failure" | "recovery" | "debrief";
}

function resolvePresentationFocus(event: TimelineEvent): PresentationFocusPanel {
  switch (event.type) {
    case "drift":
      return "timeline";
    case "alert":
      return "split";
    case "injection":
    case "failure":
    case "cascade":
      return "topology";
    case "recovery":
      return "narrative";
    default:
      return "split";
  }
}

function resolvePresentationKind(
  event: TimelineEvent,
): ScenarioPresentationBookmark["kind"] {
  if (event.type === "failure" || event.type === "cascade") {
    return "failure";
  }

  if (event.type === "recovery") {
    return "recovery";
  }

  return "signal";
}

function buildEventSpeakerNotes(
  scenario: Scenario,
  event: TimelineEvent,
): string[] {
  const affectedNodeLabels = event.affectedNodes
    .map((nodeId) => scenario.nodes.find((node) => node.id === nodeId)?.label)
    .filter((label): label is string => Boolean(label));
  const notes = [
    `Pause on ${event.title} at ${event.timestamp}s.`,
  ];

  if (affectedNodeLabels.length > 0) {
    notes.push(`Call out impacted components: ${affectedNodeLabels.join(", ")}.`);
  }

  if (event.stateDiff?.length) {
    notes.push(
      `Explain the change set: ${event.stateDiff
        .map((diff) => `${diff.field} changed from ${diff.before} to ${diff.after}`)
        .join("; ")}.`,
    );
  }

  if (event.type === "failure" || event.type === "cascade") {
    notes.push("Switch to topology and narrate the blast radius.");
  }

  if (event.type === "recovery") {
    notes.push(
      `Close with the remediation path: ${
        scenario.narrative.actions[0] ?? "review the recovery actions"
      }.`,
    );
  }

  return notes;
}

function createOverviewBookmark(scenario: Scenario): ScenarioPresentationBookmark {
  return {
    id: "bookmark-overview",
    time: 0,
    title: "Incident overview",
    label: "Overview",
    summary: scenario.subtitle || scenario.narrative.executiveSummary,
    severity: scenario.severity,
    focus: "split",
    speakerNotes: [
      `Open with the scenario summary: ${scenario.narrative.executiveSummary}`,
      `${scenario.nodes.length} nodes, ${scenario.edges.length} edges, ${scenario.events.length} events.`,
      `Frame severity as ${scenario.severity.toUpperCase()} before playback starts.`,
    ],
    eventId: null,
    kind: "overview",
  };
}

function createEventBookmark(
  scenario: Scenario,
  event: TimelineEvent,
): ScenarioPresentationBookmark {
  return {
    id: `bookmark-${event.id}`,
    time: event.timestamp,
    title: event.title,
    label: event.title,
    summary: event.description,
    severity: event.severity,
    focus: resolvePresentationFocus(event),
    speakerNotes: buildEventSpeakerNotes(scenario, event),
    eventId: event.id,
    kind: resolvePresentationKind(event),
  };
}

function createDebriefBookmark(scenario: Scenario): ScenarioPresentationBookmark {
  return {
    id: "bookmark-debrief",
    time: scenario.duration,
    title: "Debrief",
    label: "Debrief",
    summary: scenario.narrative.rootCause,
    severity: scenario.severity,
    focus: "narrative",
    speakerNotes: [
      `Summarize the root cause: ${scenario.narrative.rootCause}`,
      `Close on the actions: ${scenario.narrative.actions.join("; ")}.`,
      `Use the impact score ${scenario.narrative.impactScore} to end the narrative.`,
    ],
    eventId: null,
    kind: "debrief",
  };
}

export function buildScenarioPresentationBookmarks(
  scenario: Scenario,
): ScenarioPresentationBookmark[] {
  const bookmarks: ScenarioPresentationBookmark[] = [createOverviewBookmark(scenario)];
  const candidates = [
    scenario.events[0],
    scenario.events.find(
      (event) =>
        event.severity === "high" ||
        event.severity === "critical" ||
        event.type === "injection" ||
        event.type === "alert",
    ),
    scenario.events.find(
      (event) =>
        event.type === "failure" ||
        event.type === "cascade" ||
        event.severity === "critical",
    ),
    scenario.events.find((event) => event.type === "recovery"),
    scenario.events.at(-1),
  ].filter((event): event is TimelineEvent => Boolean(event));
  const seenEventIds = new Set<string>();

  for (const event of candidates) {
    if (seenEventIds.has(event.id)) {
      continue;
    }

    seenEventIds.add(event.id);
    bookmarks.push(createEventBookmark(scenario, event));
  }

  const debrief = createDebriefBookmark(scenario);
  const lastBookmark = bookmarks.at(-1);
  if (
    !lastBookmark ||
    lastBookmark.time !== debrief.time ||
    lastBookmark.summary !== debrief.summary
  ) {
    bookmarks.push(debrief);
  }

  return bookmarks.sort((left, right) => left.time - right.time);
}

export function getPresentationBookmarkById(
  bookmarks: ScenarioPresentationBookmark[],
  bookmarkId: string | null,
) {
  if (!bookmarkId) return null;

  return bookmarks.find((bookmark) => bookmark.id === bookmarkId) ?? null;
}

export function getActivePresentationBookmark(
  bookmarks: ScenarioPresentationBookmark[],
  currentTime: number,
) {
  if (bookmarks.length === 0) return null;

  return (
    [...bookmarks]
      .sort((left, right) => left.time - right.time)
      .filter((bookmark) => bookmark.time <= currentTime)
      .at(-1) ?? bookmarks[0]
  );
}

export function parsePresentationFocusPanel(
  value: string | null | undefined,
): PresentationFocusPanel {
  if (
    value &&
    presentationFocusPanelValues.includes(value as PresentationFocusPanel)
  ) {
    return value as PresentationFocusPanel;
  }

  return "split";
}

export function formatPresentationTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
