import { z } from "zod";
import type { Scenario } from "@/data/scenarios";
import {
  severityValues,
  timelineEventTypeValues,
  topologyNodeStatusValues,
} from "@/data/scenarios";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";
import { topologyNodeTypeValues } from "@/lib/topologyNodes";

const stateDiffSchema = z.object({
  field: z.string().min(1),
  before: z.string(),
  after: z.string(),
});

const topologyNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(topologyNodeTypeValues),
  x: z.number().finite(),
  y: z.number().finite(),
  status: z.enum(topologyNodeStatusValues),
});

const topologyEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  animated: z.boolean().optional(),
});

const timelineEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().finite().min(0),
  type: z.enum(timelineEventTypeValues),
  severity: z.enum(severityValues),
  title: z.string().min(1),
  description: z.string().min(1),
  affectedNodes: z.array(z.string().min(1)),
  stateDiff: z.array(stateDiffSchema).optional(),
});

const incidentNarrativeSchema = z.object({
  executiveSummary: z.string().min(1),
  technicalSummary: z.string().min(1),
  rootCause: z.string().min(1),
  actions: z.array(z.string().min(1)).min(1),
  impactScore: z.number().finite().min(0).max(100),
});

const scenarioSchema = z
  .object({
    schemaVersion: z.coerce.number().int().min(1).default(SCENARIO_SCHEMA_VERSION),
    id: z.string().min(1),
    name: z.string().min(1).max(80),
    subtitle: z.string().min(1).max(240),
    severity: z.enum(severityValues),
    duration: z.number().finite().positive().max(3600),
    nodes: z.array(topologyNodeSchema).min(1),
    edges: z.array(topologyEdgeSchema),
    events: z.array(timelineEventSchema).min(1),
    narrative: incidentNarrativeSchema,
  })
  .superRefine((scenario, ctx) => {
    const nodeIds = new Set<string>();
    for (const [index, node] of scenario.nodes.entries()) {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nodes", index, "id"],
          message: `Duplicate node id "${node.id}"`,
        });
      }
      nodeIds.add(node.id);
    }

    const eventIds = new Set<string>();
    for (const [index, event] of scenario.events.entries()) {
      if (eventIds.has(event.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["events", index, "id"],
          message: `Duplicate event id "${event.id}"`,
        });
      }
      eventIds.add(event.id);

      if (event.timestamp > scenario.duration) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["events", index, "timestamp"],
          message: `Event timestamp ${event.timestamp} exceeds scenario duration ${scenario.duration}`,
        });
      }

      for (const [affectedIndex, affectedNodeId] of event.affectedNodes.entries()) {
        if (!nodeIds.has(affectedNodeId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["events", index, "affectedNodes", affectedIndex],
            message: `Unknown affected node "${affectedNodeId}"`,
          });
        }
      }
    }

    for (const [index, edge] of scenario.edges.entries()) {
      if (!nodeIds.has(edge.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["edges", index, "from"],
          message: `Unknown source node "${edge.from}"`,
        });
      }

      if (!nodeIds.has(edge.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["edges", index, "to"],
          message: `Unknown destination node "${edge.to}"`,
        });
      }
    }
  })
  .transform((scenario) => ({
    ...scenario,
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    events: [...scenario.events].sort((left, right) => left.timestamp - right.timestamp),
  }));

const scenarioCollectionSchema = z.array(scenarioSchema);

function migrateScenarioInput(input: unknown) {
  if (!input || typeof input !== "object") {
    return input;
  }

  const candidate = input as Record<string, unknown>;
  return {
    ...candidate,
    schemaVersion:
      typeof candidate.schemaVersion === "number"
        ? candidate.schemaVersion
        : SCENARIO_SCHEMA_VERSION,
  };
}

function migrateScenarioCollectionInput(input: unknown) {
  if (!Array.isArray(input)) {
    return input;
  }

  return input.map((scenario) => migrateScenarioInput(scenario));
}

export function parseScenario(input: unknown): Scenario {
  return scenarioSchema.parse(migrateScenarioInput(input)) satisfies Scenario;
}

export function parseScenarioCollection(input: unknown): Scenario[] {
  return scenarioCollectionSchema.parse(migrateScenarioCollectionInput(input)) satisfies Scenario[];
}

export function formatScenarioValidationError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      })
      .join("; ");
  }

  return error instanceof Error ? error.message : String(error);
}
