import type { Scenario, TimelineEvent, TopologyEdge } from "@/data/scenarios";
import type { ScenarioBackendReplaySnapshot } from "@/lib/scenarioBackendModels";
import type { ScenarioVersionRecord } from "@/lib/scenarioWorkspace";

export type ScenarioComparisonChangeKind = "added" | "removed" | "changed";

export interface ScenarioComparisonFieldChange {
  field: string;
  before: string;
  after: string;
}

export interface ScenarioRevisionEntityChange {
  kind: ScenarioComparisonChangeKind;
  id: string;
  label: string;
  description: string;
  changes: ScenarioComparisonFieldChange[];
}

export interface ScenarioRevisionComparison {
  baseVersion: ScenarioVersionRecord;
  targetVersion: ScenarioVersionRecord;
  metadataChanges: ScenarioComparisonFieldChange[];
  nodeChanges: ScenarioRevisionEntityChange[];
  edgeChanges: ScenarioRevisionEntityChange[];
  eventChanges: ScenarioRevisionEntityChange[];
  narrativeChanges: ScenarioComparisonFieldChange[];
  summary: {
    metadataChanges: number;
    nodeAdded: number;
    nodeRemoved: number;
    nodeChanged: number;
    edgeAdded: number;
    edgeRemoved: number;
    edgeChanged: number;
    eventAdded: number;
    eventRemoved: number;
    eventChanged: number;
    narrativeChanges: number;
    totalChanges: number;
  };
}

export interface ScenarioReplayEventReference {
  id: string;
  title: string;
  severity: string;
  timestamp: number | null;
}

export interface ScenarioReplayNodeStateChange {
  nodeId: string;
  label: string;
  beforeStatus: string;
  afterStatus: string;
}

export interface ScenarioReplayComparison {
  baseSnapshot: ScenarioBackendReplaySnapshot;
  targetSnapshot: ScenarioBackendReplaySnapshot;
  baseVersion: ScenarioVersionRecord | null;
  targetVersion: ScenarioVersionRecord | null;
  contextChanges: ScenarioComparisonFieldChange[];
  nodeStateChanges: ScenarioReplayNodeStateChange[];
  activatedEvents: ScenarioReplayEventReference[];
  resolvedEvents: ScenarioReplayEventReference[];
  summary: {
    nodeStateChanges: number;
    eventsActivated: number;
    eventsResolved: number;
    timeDeltaSeconds: number;
    revisionChanged: boolean;
  };
}

function formatValue(value: unknown): string {
  if (value == null) {
    return "none";
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "none";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? `${value}` : value.toFixed(2);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (typeof value === "string") {
    return value.length > 0 ? value : "none";
  }

  return JSON.stringify(value);
}

function createFieldChange(
  field: string,
  before: unknown,
  after: unknown,
): ScenarioComparisonFieldChange | null {
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return null;
  }

  return {
    field,
    before: formatValue(before),
    after: formatValue(after),
  };
}

function createEntityChange(
  kind: ScenarioComparisonChangeKind,
  id: string,
  label: string,
  description: string,
  changes: ScenarioComparisonFieldChange[],
): ScenarioRevisionEntityChange {
  return {
    kind,
    id,
    label,
    description,
    changes,
  };
}

function sortEntityChanges(
  left: ScenarioRevisionEntityChange,
  right: ScenarioRevisionEntityChange,
) {
  return left.label.localeCompare(right.label) || left.id.localeCompare(right.id);
}

function compareNodes(baseScenario: Scenario, targetScenario: Scenario) {
  const baseNodes = new Map(baseScenario.nodes.map((node) => [node.id, node]));
  const targetNodes = new Map(targetScenario.nodes.map((node) => [node.id, node]));
  const nodeIds = new Set([...baseNodes.keys(), ...targetNodes.keys()]);
  const changes: ScenarioRevisionEntityChange[] = [];

  for (const nodeId of nodeIds) {
    const baseNode = baseNodes.get(nodeId);
    const targetNode = targetNodes.get(nodeId);

    if (!baseNode && targetNode) {
      changes.push(
        createEntityChange(
          "added",
          targetNode.id,
          targetNode.label,
          `${targetNode.type} node added`,
          [],
        ),
      );
      continue;
    }

    if (baseNode && !targetNode) {
      changes.push(
        createEntityChange(
          "removed",
          baseNode.id,
          baseNode.label,
          `${baseNode.type} node removed`,
          [],
        ),
      );
      continue;
    }

    if (!baseNode || !targetNode) {
      continue;
    }

    const fieldChanges = [
      createFieldChange("Label", baseNode.label, targetNode.label),
      createFieldChange("Type", baseNode.type, targetNode.type),
      createFieldChange("Status", baseNode.status, targetNode.status),
      createFieldChange("X position", baseNode.x, targetNode.x),
      createFieldChange("Y position", baseNode.y, targetNode.y),
    ].filter((change): change is ScenarioComparisonFieldChange => Boolean(change));

    if (fieldChanges.length > 0) {
      changes.push(
        createEntityChange(
          "changed",
          targetNode.id,
          targetNode.label,
          "Node configuration changed",
          fieldChanges,
        ),
      );
    }
  }

  return changes.sort(sortEntityChanges);
}

function describeEdge(edge: TopologyEdge) {
  return `${edge.from} -> ${edge.to}`;
}

function edgeKey(edge: TopologyEdge) {
  return `${edge.from}->${edge.to}`;
}

function compareEdges(baseScenario: Scenario, targetScenario: Scenario) {
  const baseEdges = new Map(baseScenario.edges.map((edge) => [edgeKey(edge), edge]));
  const targetEdges = new Map(targetScenario.edges.map((edge) => [edgeKey(edge), edge]));
  const edgeIds = new Set([...baseEdges.keys(), ...targetEdges.keys()]);
  const changes: ScenarioRevisionEntityChange[] = [];

  for (const key of edgeIds) {
    const baseEdge = baseEdges.get(key);
    const targetEdge = targetEdges.get(key);

    if (!baseEdge && targetEdge) {
      changes.push(
        createEntityChange("added", key, describeEdge(targetEdge), "Connection added", []),
      );
      continue;
    }

    if (baseEdge && !targetEdge) {
      changes.push(
        createEntityChange("removed", key, describeEdge(baseEdge), "Connection removed", []),
      );
      continue;
    }

    if (!baseEdge || !targetEdge) {
      continue;
    }

    const fieldChanges = [
      createFieldChange(
        "Animated",
        baseEdge.animated ?? false,
        targetEdge.animated ?? false,
      ),
    ].filter((change): change is ScenarioComparisonFieldChange => Boolean(change));

    if (fieldChanges.length > 0) {
      changes.push(
        createEntityChange(
          "changed",
          key,
          describeEdge(targetEdge),
          "Connection behavior changed",
          fieldChanges,
        ),
      );
    }
  }

  return changes.sort(sortEntityChanges);
}

function eventFieldChanges(baseEvent: TimelineEvent, targetEvent: TimelineEvent) {
  return [
    createFieldChange("Timestamp", baseEvent.timestamp, targetEvent.timestamp),
    createFieldChange("Type", baseEvent.type, targetEvent.type),
    createFieldChange("Severity", baseEvent.severity, targetEvent.severity),
    createFieldChange("Title", baseEvent.title, targetEvent.title),
    createFieldChange("Description", baseEvent.description, targetEvent.description),
    createFieldChange(
      "Affected nodes",
      baseEvent.affectedNodes,
      targetEvent.affectedNodes,
    ),
    createFieldChange(
      "State diff",
      baseEvent.stateDiff?.map((diff) => `${diff.field}: ${diff.before} -> ${diff.after}`) ?? [],
      targetEvent.stateDiff?.map((diff) => `${diff.field}: ${diff.before} -> ${diff.after}`) ?? [],
    ),
  ].filter((change): change is ScenarioComparisonFieldChange => Boolean(change));
}

function compareEvents(baseScenario: Scenario, targetScenario: Scenario) {
  const baseEvents = new Map(baseScenario.events.map((event) => [event.id, event]));
  const targetEvents = new Map(targetScenario.events.map((event) => [event.id, event]));
  const eventIds = new Set([...baseEvents.keys(), ...targetEvents.keys()]);
  const changes: ScenarioRevisionEntityChange[] = [];

  for (const eventId of eventIds) {
    const baseEvent = baseEvents.get(eventId);
    const targetEvent = targetEvents.get(eventId);

    if (!baseEvent && targetEvent) {
      changes.push(
        createEntityChange(
          "added",
          targetEvent.id,
          targetEvent.title,
          `Event added at ${targetEvent.timestamp}s`,
          [],
        ),
      );
      continue;
    }

    if (baseEvent && !targetEvent) {
      changes.push(
        createEntityChange(
          "removed",
          baseEvent.id,
          baseEvent.title,
          `Event removed from ${baseEvent.timestamp}s`,
          [],
        ),
      );
      continue;
    }

    if (!baseEvent || !targetEvent) {
      continue;
    }

    const fieldChanges = eventFieldChanges(baseEvent, targetEvent);
    if (fieldChanges.length > 0) {
      changes.push(
        createEntityChange(
          "changed",
          targetEvent.id,
          targetEvent.title,
          "Timeline event changed",
          fieldChanges,
        ),
      );
    }
  }

  return changes.sort(sortEntityChanges);
}

function compareNarrative(baseScenario: Scenario, targetScenario: Scenario) {
  return [
    createFieldChange(
      "Executive summary",
      baseScenario.narrative.executiveSummary,
      targetScenario.narrative.executiveSummary,
    ),
    createFieldChange(
      "Technical summary",
      baseScenario.narrative.technicalSummary,
      targetScenario.narrative.technicalSummary,
    ),
    createFieldChange(
      "Root cause",
      baseScenario.narrative.rootCause,
      targetScenario.narrative.rootCause,
    ),
    createFieldChange(
      "Actions",
      baseScenario.narrative.actions,
      targetScenario.narrative.actions,
    ),
    createFieldChange(
      "Impact score",
      baseScenario.narrative.impactScore,
      targetScenario.narrative.impactScore,
    ),
  ].filter((change): change is ScenarioComparisonFieldChange => Boolean(change));
}

function countChanges(
  changes: ScenarioRevisionEntityChange[],
  kind: ScenarioComparisonChangeKind,
) {
  return changes.filter((change) => change.kind === kind).length;
}

export function compareScenarioVersions(
  baseVersion: ScenarioVersionRecord,
  targetVersion: ScenarioVersionRecord,
): ScenarioRevisionComparison {
  const baseScenario = baseVersion.scenario;
  const targetScenario = targetVersion.scenario;
  const metadataChanges = [
    createFieldChange("Name", baseScenario.name, targetScenario.name),
    createFieldChange("Subtitle", baseScenario.subtitle, targetScenario.subtitle),
    createFieldChange("Severity", baseScenario.severity, targetScenario.severity),
    createFieldChange("Duration", baseScenario.duration, targetScenario.duration),
  ].filter((change): change is ScenarioComparisonFieldChange => Boolean(change));
  const nodeChanges = compareNodes(baseScenario, targetScenario);
  const edgeChanges = compareEdges(baseScenario, targetScenario);
  const eventChanges = compareEvents(baseScenario, targetScenario);
  const narrativeChanges = compareNarrative(baseScenario, targetScenario);
  const totalChanges =
    metadataChanges.length +
    nodeChanges.length +
    edgeChanges.length +
    eventChanges.length +
    narrativeChanges.length;

  return {
    baseVersion,
    targetVersion,
    metadataChanges,
    nodeChanges,
    edgeChanges,
    eventChanges,
    narrativeChanges,
    summary: {
      metadataChanges: metadataChanges.length,
      nodeAdded: countChanges(nodeChanges, "added"),
      nodeRemoved: countChanges(nodeChanges, "removed"),
      nodeChanged: countChanges(nodeChanges, "changed"),
      edgeAdded: countChanges(edgeChanges, "added"),
      edgeRemoved: countChanges(edgeChanges, "removed"),
      edgeChanged: countChanges(edgeChanges, "changed"),
      eventAdded: countChanges(eventChanges, "added"),
      eventRemoved: countChanges(eventChanges, "removed"),
      eventChanged: countChanges(eventChanges, "changed"),
      narrativeChanges: narrativeChanges.length,
      totalChanges,
    },
  };
}

function buildVersionLookup(versionRecords: ScenarioVersionRecord[]) {
  return new Map(versionRecords.map((version) => [version.id, version]));
}

function buildEventLookup(version: ScenarioVersionRecord | null) {
  return new Map((version?.scenario.events ?? []).map((event) => [event.id, event]));
}

function buildNodeLookup(version: ScenarioVersionRecord | null) {
  return new Map((version?.scenario.nodes ?? []).map((node) => [node.id, node]));
}

function createReplayEventReference(
  eventId: string,
  event: TimelineEvent | undefined,
): ScenarioReplayEventReference {
  return {
    id: eventId,
    title: event?.title ?? eventId,
    severity: event?.severity ?? "unknown",
    timestamp: event?.timestamp ?? null,
  };
}

export function compareReplaySnapshots(input: {
  baseSnapshot: ScenarioBackendReplaySnapshot;
  targetSnapshot: ScenarioBackendReplaySnapshot;
  versionRecords: ScenarioVersionRecord[];
}): ScenarioReplayComparison {
  const versionLookup = buildVersionLookup(input.versionRecords);
  const baseVersion = versionLookup.get(input.baseSnapshot.scenarioVersionId) ?? null;
  const targetVersion = versionLookup.get(input.targetSnapshot.scenarioVersionId) ?? null;
  const baseEvents = buildEventLookup(baseVersion);
  const targetEvents = buildEventLookup(targetVersion);
  const baseNodes = buildNodeLookup(baseVersion);
  const targetNodes = buildNodeLookup(targetVersion);
  const contextChanges = [
    createFieldChange("Trigger", input.baseSnapshot.trigger, input.targetSnapshot.trigger),
    createFieldChange("Playback time (s)", input.baseSnapshot.currentTime, input.targetSnapshot.currentTime),
    createFieldChange("Revision", baseVersion?.revision ?? "none", targetVersion?.revision ?? "none"),
  ].filter((change): change is ScenarioComparisonFieldChange => Boolean(change));

  const nodeIds = new Set([
    ...Object.keys(input.baseSnapshot.nodeStates),
    ...Object.keys(input.targetSnapshot.nodeStates),
  ]);
  const nodeStateChanges = Array.from(nodeIds)
    .map((nodeId) => {
      const beforeStatus = input.baseSnapshot.nodeStates[nodeId] ?? "unknown";
      const afterStatus = input.targetSnapshot.nodeStates[nodeId] ?? "unknown";

      if (beforeStatus === afterStatus) {
        return null;
      }

      const label =
        targetNodes.get(nodeId)?.label ??
        baseNodes.get(nodeId)?.label ??
        nodeId;

      return {
        nodeId,
        label,
        beforeStatus,
        afterStatus,
      } satisfies ScenarioReplayNodeStateChange;
    })
    .filter((change): change is ScenarioReplayNodeStateChange => Boolean(change))
    .sort((left, right) => left.label.localeCompare(right.label));

  const baseEventIds = new Set(input.baseSnapshot.activeEventIds);
  const targetEventIds = new Set(input.targetSnapshot.activeEventIds);
  const activatedEvents = input.targetSnapshot.activeEventIds
    .filter((eventId) => !baseEventIds.has(eventId))
    .map((eventId) => createReplayEventReference(eventId, targetEvents.get(eventId)))
    .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));
  const resolvedEvents = input.baseSnapshot.activeEventIds
    .filter((eventId) => !targetEventIds.has(eventId))
    .map((eventId) =>
      createReplayEventReference(
        eventId,
        baseEvents.get(eventId) ?? targetEvents.get(eventId),
      ),
    )
    .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));

  return {
    baseSnapshot: input.baseSnapshot,
    targetSnapshot: input.targetSnapshot,
    baseVersion,
    targetVersion,
    contextChanges,
    nodeStateChanges,
    activatedEvents,
    resolvedEvents,
    summary: {
      nodeStateChanges: nodeStateChanges.length,
      eventsActivated: activatedEvents.length,
      eventsResolved: resolvedEvents.length,
      timeDeltaSeconds:
        input.targetSnapshot.currentTime - input.baseSnapshot.currentTime,
      revisionChanged:
        (baseVersion?.revision ?? null) !== (targetVersion?.revision ?? null),
    },
  };
}
