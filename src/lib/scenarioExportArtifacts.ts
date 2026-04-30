import type { Scenario, TopologyNode } from "@/data/scenarios";
import type { ScenarioBackendReplaySnapshot } from "@/lib/scenarioBackendModels";
import type {
  ScenarioAuditEvent,
  ScenarioWorkspaceOrigin,
} from "@/lib/scenarioWorkspace";

export type ScenarioRichExportKind =
  | "scenario-json"
  | "incident-report"
  | "postmortem"
  | "playback-brief";

interface ScenarioReplayState {
  currentTime: number;
  activeEventIds: string[];
  nodeStates: Record<string, TopologyNode["status"]>;
}

export interface ScenarioRichExportContext {
  scenario: Scenario;
  origin: ScenarioWorkspaceOrigin;
  revision: number | null;
  currentRevision: number | null;
  publishedRevision: number | null;
  shareUrl: string | null;
  exportedAt?: string;
  auditLog: ScenarioAuditEvent[];
  replaySnapshots: ScenarioBackendReplaySnapshot[];
  replayState: ScenarioReplayState;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function resolveExportedAt(exportedAt?: string) {
  return exportedAt ?? new Date().toISOString();
}

function formatAbsoluteTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(new Date(timestamp));
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function formatScenarioTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function getScenarioNodeLabelMap(scenario: Scenario) {
  return new Map(scenario.nodes.map((node) => [node.id, node.label]));
}

function getCurrentNodeStates(input: ScenarioRichExportContext) {
  return scenarioNodesWithState(input).filter(
    (node) => node.status === "degraded" || node.status === "down",
  );
}

function scenarioNodesWithState(input: ScenarioRichExportContext) {
  return input.scenario.nodes.map((node) => ({
    ...node,
    status: input.replayState.nodeStates[node.id] ?? node.status,
  }));
}

function getActiveEventSummaries(input: ScenarioRichExportContext) {
  const activeEventIds = new Set(input.replayState.activeEventIds);
  return input.scenario.events.filter((event) => activeEventIds.has(event.id));
}

function getScenarioAuditLog(input: ScenarioRichExportContext) {
  return input.auditLog
    .filter((event) => event.scenarioId === input.scenario.id)
    .slice()
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function getScenarioReplaySnapshots(input: ScenarioRichExportContext) {
  return input.replaySnapshots
    .filter((snapshot) => snapshot.scenarioId === input.scenario.id)
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function buildMetadataLines(input: ScenarioRichExportContext) {
  return [
    `- Exported at: ${formatAbsoluteTimestamp(resolveExportedAt(input.exportedAt))}`,
    `- Scenario origin: ${input.origin}`,
    `- Scenario severity: ${input.scenario.severity}`,
    `- Impact score: ${input.scenario.narrative.impactScore}/100`,
    `- Topology: ${input.scenario.nodes.length} nodes / ${input.scenario.edges.length} edges`,
    `- Timeline length: ${formatDuration(input.scenario.duration)} across ${input.scenario.events.length} events`,
    `- Viewing revision: ${input.revision ?? input.currentRevision ?? "latest"}`,
    `- Published revision: ${input.publishedRevision ?? "not published"}`,
  ];
}

function buildTopologySummary(input: ScenarioRichExportContext) {
  const grouped = new Map<string, string[]>();

  for (const node of scenarioNodesWithState(input)) {
    const key = `${node.type} (${node.status})`;
    const group = grouped.get(key) ?? [];
    group.push(node.label);
    grouped.set(key, group);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([group, labels]) => `- ${group}: ${labels.join(", ")}`);
}

function buildTimelineSummary(input: ScenarioRichExportContext) {
  const nodeLabelMap = getScenarioNodeLabelMap(input.scenario);

  return input.scenario.events.map((event) => {
    const affectedNodes = event.affectedNodes
      .map((nodeId) => nodeLabelMap.get(nodeId) ?? nodeId)
      .filter(Boolean);

    const affectedText =
      affectedNodes.length > 0 ? ` Affected: ${affectedNodes.join(", ")}.` : "";

    return `1. [${formatScenarioTimestamp(event.timestamp)}] ${event.severity.toUpperCase()} - ${event.title}\n${event.description}${affectedText}`;
  });
}

function buildReplaySummary(input: ScenarioRichExportContext) {
  const activeEvents = getActiveEventSummaries(input);
  const degradedNodes = getCurrentNodeStates(input);

  return [
    `- Current playback position: ${formatScenarioTimestamp(input.replayState.currentTime)}`,
    `- Active event count: ${activeEvents.length}`,
    `- Active events: ${activeEvents.length > 0 ? activeEvents.map((event) => event.title).join(", ") : "none"}`,
    `- Nodes currently degraded or down: ${degradedNodes.length > 0 ? degradedNodes.map((node) => `${node.label} (${node.status})`).join(", ") : "none"}`,
  ];
}

function buildAuditSummary(input: ScenarioRichExportContext) {
  const auditEvents = getScenarioAuditLog(input);

  if (auditEvents.length === 0) {
    return ["- No scenario-specific audit activity recorded yet."];
  }

  return auditEvents.slice(-8).map((event) => {
    const actor = event.actorName ?? event.actorEmail ?? event.actorRole ?? "system";
    return `- ${formatAbsoluteTimestamp(event.createdAt)} - ${actor}: ${event.message}`;
  });
}

function buildReplaySnapshotSummary(input: ScenarioRichExportContext) {
  const replaySnapshots = getScenarioReplaySnapshots(input);

  if (replaySnapshots.length === 0) {
    return ["- No replay snapshots have been captured for this scenario yet."];
  }

  const triggerCounts = replaySnapshots.reduce<Record<string, number>>((counts, snapshot) => {
    counts[snapshot.trigger] = (counts[snapshot.trigger] ?? 0) + 1;
    return counts;
  }, {});

  return [
    `- Snapshots captured: ${replaySnapshots.length}`,
    `- Latest snapshot: ${formatAbsoluteTimestamp(replaySnapshots[0].createdAt)}`,
    `- Triggers: ${Object.entries(triggerCounts)
      .map(([trigger, count]) => `${trigger} (${count})`)
      .join(", ")}`,
  ];
}

function buildShareLinkSection(input: ScenarioRichExportContext) {
  if (!input.shareUrl) {
    return [
      "## Playback Link",
      "",
      "Playback link export is unavailable for the current access profile.",
    ].join("\n");
  }

  return [
    "## Playback Link",
    "",
    `[Open the scenario playback](${input.shareUrl})`,
    "",
    input.shareUrl,
  ].join("\n");
}

export function createIncidentReportMarkdown(input: ScenarioRichExportContext) {
  return [
    `# ${input.scenario.name} Incident Report`,
    "",
    input.scenario.subtitle,
    "",
    "## Metadata",
    ...buildMetadataLines(input),
    "",
    "## Executive Summary",
    "",
    input.scenario.narrative.executiveSummary,
    "",
    "## Technical Summary",
    "",
    input.scenario.narrative.technicalSummary,
    "",
    "## Topology Overview",
    ...buildTopologySummary(input),
    "",
    "## Incident Timeline",
    ...buildTimelineSummary(input),
    "",
    "## Current Replay State",
    ...buildReplaySummary(input),
    "",
    "## Actions",
    ...input.scenario.narrative.actions.map((action) => `- ${action}`),
    "",
    buildShareLinkSection(input),
  ].join("\n");
}

export function createPostmortemMarkdown(input: ScenarioRichExportContext) {
  const primaryFailureEvents = input.scenario.events
    .filter((event) => event.type !== "recovery")
    .slice(0, 4)
    .map((event) => `- ${event.title}`);
  const recoveryEvents = input.scenario.events
    .filter((event) => event.type === "recovery")
    .slice(0, 4)
    .map((event) => `- ${event.title}`);

  return [
    `# ${input.scenario.name} Postmortem`,
    "",
    input.scenario.subtitle,
    "",
    "## Incident Summary",
    "",
    input.scenario.narrative.executiveSummary,
    "",
    "## Root Cause",
    "",
    input.scenario.narrative.rootCause,
    "",
    "## Contributing Factors",
    ...(primaryFailureEvents.length > 0
      ? primaryFailureEvents
      : ["- No contributing factors were inferred from the current timeline."]),
    "",
    "## Recovery Summary",
    ...(recoveryEvents.length > 0
      ? recoveryEvents
      : ["- No explicit recovery events are present in the current scenario timeline."]),
    "",
    "## Audit Trail",
    ...buildAuditSummary(input),
    "",
    "## Replay Snapshot Summary",
    ...buildReplaySnapshotSummary(input),
    "",
    "## Follow-Up Actions",
    ...input.scenario.narrative.actions.map((action) => `- ${action}`),
    "",
    buildShareLinkSection(input),
  ].join("\n");
}

export function createPlaybackBriefMarkdown(input: ScenarioRichExportContext) {
  const keyMoments = input.scenario.events
    .slice(0, 5)
    .map(
      (event) =>
        `- ${formatScenarioTimestamp(event.timestamp)} - ${event.title} (${event.severity})`,
    );

  return [
    `# ${input.scenario.name} Playback Brief`,
    "",
    input.scenario.subtitle,
    "",
    "## Presenter Summary",
    "",
    input.scenario.narrative.executiveSummary,
    "",
    buildShareLinkSection(input),
    "",
    "## Current Playback Context",
    ...buildReplaySummary(input),
    "",
    "## Key Moments",
    ...keyMoments,
    "",
    "## Suggested Talking Points",
    `- Focus on the revision currently under review: ${input.revision ?? input.currentRevision ?? "latest"}.`,
    `- Highlight the highest-severity points in the timeline: ${input.scenario.events
      .filter((event) => event.severity === "critical" || event.severity === "high")
      .slice(0, 3)
      .map((event) => event.title)
      .join(", ") || "none"}.`,
    `- Close with the planned follow-up actions: ${input.scenario.narrative.actions.join(", ")}.`,
  ].join("\n");
}

export function formatScenarioExportFilename(
  scenario: Scenario,
  kind: ScenarioRichExportKind,
  extension: "json" | "md",
  revision?: number | null,
  exportedAt?: string,
) {
  const date = resolveExportedAt(exportedAt).slice(0, 10);
  const revisionSegment = revision ? `-r${revision}` : "";

  return `${slugify(scenario.name)}-${kind}${revisionSegment}-${date}.${extension}`;
}
