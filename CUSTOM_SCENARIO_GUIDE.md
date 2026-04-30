# Custom Scenario Creation Guide

## Overview

This guide is aligned with the current project model in `src/data/scenarios.ts` and the scenario builder used by the app.

System Drift Simulator stores custom incident scenarios as JSON objects with a strict schema. Scenarios are made of topology nodes, edges, timeline events, and a narrative. The app plays them back as a live incident simulation with event-driven node state changes and progressive narrative reveals.

## Best Way to Create a Scenario

### Option 1: Build in the App

- Use the scenario builder to add nodes, draw edges, and define incident events.
- The UI persists the scenario into the active workspace once saved.
- You can replay the simulation immediately, inspect node state changes, and watch the narrative unlock as the incident progresses.

### Option 2: Import JSON

- Import a scenario JSON file through the app’s import flow.
- The imported JSON must match the project schema, including `schemaVersion`, `nodes`, `edges`, `events`, and `narrative`.
- Example assets are available in `examples/imports/` and the public `scenario-template.json`.

### Option 3: Export and Edit

- Export an existing scenario from the app.
- Edit the exported JSON locally.
- Re-import the updated file to apply changes.

## Scenario Schema

A scenario must include these top-level fields:
- `schemaVersion` — the scenario schema version
- `id` — unique scenario identifier
- `name` — display title
- `subtitle` — short description
- `severity` — one of `critical`, `high`, `medium`, `low`, `info`
- `duration` — total incident length in seconds
- `nodes` — topology nodes
- `edges` — node relationships
- `events` — timeline events
- `narrative` — incident story

### Minimal example

```json
{
  "schemaVersion": 1,
  "id": "custom-incident-001",
  "name": "Unauthorized Access Simulation",
  "subtitle": "Simulated auth compromise and containment",
  "severity": "high",
  "duration": 120,
  "nodes": [],
  "edges": [],
  "events": [],
  "narrative": {
    "executiveSummary": "...",
    "technicalSummary": "...",
    "rootCause": "...",
    "actions": ["..."],
    "impactScore": 75
  }
}
```

## Topology Nodes

Nodes define the system components in the topology.

### Node fields

- `id` — unique node identifier
- `label` — how the node appears in the UI
- `type` — one of the supported topology node types
- `x`, `y` — position coordinates for the topology layout
- `status` — initial node status

### Supported node types

The app supports these node types:

- Clients & Edge: `client`, `mobile`, `dns`, `gateway`, `load-balancer`
- Compute & Apps: `service`, `compute`, `serverless`, `worker`, `ai`
- Data & Messaging: `database`, `storage`, `cache`, `queue`, `stream`
- Control & Ops: `identity`, `observability`, `security`, `ci-cd`
- Integrations: `external`

### Status values

- `healthy`
- `degraded`
- `down`
- `unknown`

> The timeline engine updates node state dynamically as events trigger. The initial `status` is the starting state before the first event.

## Edges

Edges represent relationships and data flow between nodes.

### Edge fields

- `from` — source node id
- `to` — target node id
- `animated` — optional boolean for edge animation

### Practical guidance

- Connect services to their downstream dependencies.
- Link ingress/gateway nodes to the services they reach.
- Use simple, directional flows rather than overlapping line spaghetti.

## Timeline Events

Events are the core of the incident simulation.

### Event fields

- `id` — unique event identifier
- `timestamp` — seconds into the scenario
- `type` — one of the supported event types
- `severity` — impact level
- `title` — brief event title
- `description` — event details
- `affectedNodes` — list of affected node ids
- `stateDiff` — optional array of state change details

### Supported event types

- `drift` — config or behavior drift
- `alert` — a warning or monitoring signal
- `failure` — component failure or outage
- `recovery` — remediation or recovery action
- `injection` — intentional test or threat injection
- `cascade` — failure propagation to dependent components

### Severity values

- `critical`
- `high`
- `medium`
- `low`
- `info`

### Important behavior

- `timestamp` is measured in seconds from scenario start.
- Events should be sorted chronologically.
- `affectedNodes` must match the node ids defined in `nodes`.
- `stateDiff` is optional and is used for additional incident context.

## Incident Narrative

The app renders the narrative progressively as the scenario plays.

### Narrative fields

- `executiveSummary` — top-level impact summary
- `technicalSummary` — detailed technical analysis
- `rootCause` — primary failure cause
- `actions` — recommended remediation actions
- `impactScore` — number between 0 and 100

### Reveal thresholds

- 0% progress: Executive Summary is visible
- >30% progress: Technical Summary is revealed
- >50% progress: Root Cause is revealed
- >70% progress: Recommended Actions are revealed

## Real example from the app

Here is a real scenario structure modeled on the current project data:

```json
{
  "schemaVersion": 1,
  "id": "supply-chain-attack",
  "name": "Supply Chain Compromise",
  "subtitle": "Malicious dependency injection via CI/CD pipeline drift",
  "severity": "critical",
  "duration": 180,
  "nodes": [
    { "id": "gateway", "label": "API Gateway", "type": "gateway", "x": 400, "y": 60, "status": "healthy" },
    { "id": "auth", "label": "Auth Service", "type": "service", "x": 200, "y": 180, "status": "healthy" },
    { "id": "api", "label": "Core API", "type": "service", "x": 400, "y": 180, "status": "healthy" },
    { "id": "worker", "label": "Worker Pool", "type": "service", "x": 600, "y": 180, "status": "healthy" },
    { "id": "db", "label": "PostgreSQL", "type": "database", "x": 300, "y": 320, "status": "healthy" },
    { "id": "cache", "label": "Redis Cache", "type": "cache", "x": 500, "y": 320, "status": "healthy" },
    { "id": "queue", "label": "Message Queue", "type": "queue", "x": 600, "y": 320, "status": "healthy" },
    { "id": "cdn", "label": "CDN / Static", "type": "external", "x": 100, "y": 60, "status": "healthy" }
  ],
  "edges": [
    { "from": "gateway", "to": "auth" },
    { "from": "gateway", "to": "api" },
    { "from": "api", "to": "db" },
    { "from": "api", "to": "cache" },
    { "from": "api", "to": "worker" },
    { "from": "worker", "to": "queue" },
    { "from": "worker", "to": "db" },
    { "from": "cdn", "to": "gateway" },
    { "from": "auth", "to": "db" }
  ],
  "events": [
    { "id": "e1", "timestamp": 0, "type": "drift", "severity": "info", "title": "CI/CD pipeline config drift detected", "description": "Build pipeline YAML modified — new npm registry mirror added to dependency resolution chain.", "affectedNodes": ["api"], "stateDiff": [{ "field": "npm_registry", "before": "registry.npmjs.org", "after": "npm-mirror.internal.io" }] },
    { "id": "e2", "timestamp": 15, "type": "drift", "severity": "medium", "title": "Dependency checksum mismatch", "description": "Package `event-stream@4.0.1` integrity hash differs from baseline lockfile.", "affectedNodes": ["api"], "stateDiff": [{ "field": "event-stream.sha512", "before": "a3f8c1...baseline", "after": "7d2e9b...modified" }] },
    { "id": "e3", "timestamp": 35, "type": "injection", "severity": "high", "title": "Malicious payload deployed", "description": "Modified dependency includes obfuscated exfiltration code targeting environment variables.", "affectedNodes": ["api", "worker"] },
    { "id": "e4", "timestamp": 55, "type": "alert", "severity": "high", "title": "Anomalous outbound connections", "description": "Core API initiating HTTPS connections to unknown external IP 45.33.x.x on port 8443.", "affectedNodes": ["api"] },
    { "id": "e5", "timestamp": 75, "type": "cascade", "severity": "critical", "title": "Database credentials exfiltrated", "description": "Environment variable DB_PASSWORD observed in outbound payload.", "affectedNodes": ["api", "db"] },
    { "id": "e6", "timestamp": 95, "type": "failure", "severity": "critical", "title": "Unauthorized database access", "description": "Foreign IP authenticated to PostgreSQL using exfiltrated credentials.", "affectedNodes": ["db"] },
    { "id": "e7", "timestamp": 120, "type": "alert", "severity": "critical", "title": "Data exfiltration in progress", "description": "Bulk SELECT queries and chunked HTTPS uploads detected.", "affectedNodes": ["db", "api"] },
    { "id": "e8", "timestamp": 145, "type": "recovery", "severity": "high", "title": "Emergency credential rotation", "description": "All database passwords rotated. Foreign IP blocked.", "affectedNodes": ["db", "api", "auth"] },
    { "id": "e9", "timestamp": 165, "type": "recovery", "severity": "medium", "title": "Pipeline lockdown & audit", "description": "CI/CD pipeline reverted to signed baseline.", "affectedNodes": ["api", "worker"] },
    { "id": "e10", "timestamp": 180, "type": "recovery", "severity": "low", "title": "Incident contained", "description": "All services restored to known-good baseline.", "affectedNodes": [] }
  ],
  "narrative": {
    "executiveSummary": "A supply chain attack compromised the CI/CD pipeline and exfiltrated database credentials.",
    "technicalSummary": "Unsigned pipeline configuration allowed a dependency substitution that deployed credential-harvesting code from a malicious npm mirror.",
    "rootCause": "CI/CD config drift and missing dependency integrity verification.",
    "actions": [
      "Enforce cryptographic signing for pipeline configuration",
      "Enable dependency hash verification",
      "Block unauthorized outbound egress",
      "Rotate credentials and audit access logs"
    ],
    "impactScore": 92
  }
}
```

## Troubleshooting

### Import errors

- Ensure the JSON is valid and includes `schemaVersion`.
- Verify that `nodes`, `edges`, `events`, and `narrative` all exist.
- Confirm every node referenced in `edges` and `affectedNodes` is defined.
- Timestamps must be within the scenario duration.

### Scenario validation

- Node IDs must be unique.
- Event IDs must be unique.
- Event timestamps should be sorted and within range.
- `severity` must use the allowed values.
- `type` must be one of the row event types.

## Notes

- The app does not accept custom fields outside this schema.
- `public/scenario-template.json` is a sample asset and can be used as a starting point.
- The builder is intentionally oriented around incident playback, not arbitrary graph editing.
- The narrative unlocks as the scenario progresses, so a good story is tied directly to the timeline.
