# Custom Scenario Creation Guide

## Overview

The System Drift Simulator allows you to create and manage custom incident scenarios. This guide walks you through building scenarios from scratch or by modifying exported templates.

## Quick Start

### Option 1: Build Via UI (Recommended)

1. Click **"Build Custom Scenario"** in the sidebar
2. Follow the 5-step wizard:
   - **Scenario**: Define metadata (name, description, severity, duration)
   - **Nodes**: Add system components (services, databases, gateways, etc.)
   - **Edges**: Define connections between nodes
   - **Events**: Create timeline of incident events
   - **Review**: Verify and save your scenario

### Option 2: Import JSON File

1. Click **"Import"** in the header
2. Select a `.json` file with your scenario
3. The scenario is automatically loaded and available for use

### Option 3: Export & Modify

1. Select any existing scenario
2. Click **"Export"** to download as JSON
3. Edit the JSON file locally
4. Click **"Import"** to load your modified version

## Scenario Structure (JSON Format)

```json
{
  "id": "my-scenario-001",
  "name": "Database Migration Failure",
  "subtitle": "Schema migration causes cascading failures",
  "severity": "critical",
  "duration": 300,
  "nodes": [...],
  "edges": [...],
  "events": [...],
  "narrative": {...}
}
```

### Key Fields

- **id** (string): Unique identifier. Use format: `custom-{name}-{timestamp}`
- **name** (string): Display name (1-50 characters)
- **subtitle** (string): Brief description of the scenario
- **severity** (string): One of: `critical`, `high`, `medium`, `low`, `info`
- **duration** (number): Total incident duration in seconds
- **nodes** (array): System topology components
- **edges** (array): Connections between nodes
- **events** (array): Timeline of incident events
- **narrative** (object): Human-readable incident story

## Nodes (System Components)

Nodes represent system components in your topology.

### Node Structure

```json
{
  "id": "api-gateway-01",
  "label": "API Gateway",
  "type": "gateway",
  "x": 400,
  "y": 60,
  "status": "healthy"
}
```

### Node Types

The builder supports a broader node catalog so you can model platform, security, data, and edge-heavy scenarios more realistically.

- **Clients & Edge**: `client`, `mobile`, `dns`, `gateway`, `load-balancer`
- **Compute & Apps**: `service`, `compute`, `serverless`, `worker`, `ai`
- **Data & Messaging**: `database`, `storage`, `cache`, `queue`, `stream`
- **Control & Ops**: `identity`, `observability`, `security`, `ci-cd`
- **Integrations**: `external`

Use the **Node Type** picker in the Scenario Builder for the full grouped catalog, or the **Quick Add** chips for the most common system components.

### Positioning

- **x, y**: Coordinates in SVG viewport (0-800 horizontally, 0-400 vertically)
- Use a layout tool or manually space nodes logically
- Nodes can be dragged in the UI to reposition

### Status

The initial `status` field is overridden by events. Valid values:
- `healthy`: Normal operation
- `degraded`: Performance issues, partial failures
- `down`: Complete outage
- `unknown`: Unknown state

## Edges (Connections)

Edges represent data flow or dependencies between nodes.

### Edge Structure

```json
{
  "from": "api-gateway-01",
  "to": "api-service-01",
  "animated": true
}
```

### Properties

- **from** (string): Source node ID
- **to** (string): Target node ID
- **animated** (boolean, optional): Show propagation particles on edge

### Guidelines

- Create edges from entry points (gateway) toward internal services
- Connect services to their dependencies (services → databases)
- Use multiple edges to show complex interactions
- Minimum 1 edge required for a valid scenario

## Events (Incident Timeline)

Events are the incidents that occur during the scenario. They define what happens and when.

### Event Structure

```json
{
  "id": "evt-database-lock",
  "timestamp": 45,
  "type": "failure",
  "severity": "critical",
  "title": "Database Lock Escalation",
  "description": "Long-running transaction causing lock escalation and deadlocks",
  "affectedNodes": ["database-primary", "database-replica"],
  "stateDiff": [
    {
      "field": "lock_count",
      "before": "10",
      "after": "1000"
    }
  ]
}
```

### Event Types

| Type | Meaning |
|------|---------|
| `drift` | Performance or behavior change |
| `alert` | Warning condition detected |
| `failure` | Component failure or outage |
| `recovery` | Component recovers from failure |
| `injection` | Intentional test or chaos injection |
| `cascade` | Failure cascades to other components |

### Event Severity

Same as scenario severity: `critical`, `high`, `medium`, `low`, `info`

### Guidelines

- **timestamp**: In seconds, relative to scenario start (0 = start)
- **affectedNodes**: Array of node IDs impacted by this event
- **stateDiff**: Optional detailed state changes (metadata)
- Events should be in chronological order

### Example Event Sequence

```json
[
  { "timestamp": 10, "type": "alert", "severity": "medium", "title": "High CPU Usage", "affectedNodes": ["service-1"] },
  { "timestamp": 30, "type": "failure", "severity": "critical", "title": "OOM Kill", "affectedNodes": ["service-1"] },
  { "timestamp": 32, "type": "cascade", "severity": "critical", "title": "Downstream Requests Timeout", "affectedNodes": ["service-2"] },
  { "timestamp": 120, "type": "recovery", "severity": "info", "title": "Service Restart Complete", "affectedNodes": ["service-1"] }
]
```

## Narrative (Incident Story)

The narrative provides human-readable explanations revealed progressively during playback.

### Narrative Structure

```json
{
  "executiveSummary": "High-level business impact summary",
  "technicalSummary": "Technical details of the failure",
  "rootCause": "Primary cause of the incident",
  "actions": ["Action 1", "Action 2", "Action 3"],
  "impactScore": 85
}
```

### Properties

- **executiveSummary**: 1-2 sentences, focus on impact
- **technicalSummary**: Detailed technical explanation
- **rootCause**: Single sentence identifying primary cause
- **actions**: Array of remediation or preventive actions
- **impactScore**: Number 0-100 representing severity impact

### Progressive Reveal

The narrative sections are revealed based on playback progress:
- 0% → Executive Summary (always visible)
- 30% → Technical Summary
- 50% → Root Cause
- 70% → Actions

## Complete Example

```json
{
  "id": "custom-cache-failure-001",
  "name": "Cache Layer Cascade Failure",
  "subtitle": "Redis cache failure cascades to database overload",
  "severity": "high",
  "duration": 180,
  "nodes": [
    { "id": "gateway", "label": "API Gateway", "type": "gateway", "x": 400, "y": 60, "status": "healthy" },
    { "id": "api", "label": "API Service", "type": "service", "x": 400, "y": 160, "status": "healthy" },
    { "id": "cache", "label": "Redis Cache", "type": "cache", "x": 250, "y": 280, "status": "healthy" },
    { "id": "db", "label": "PostgreSQL", "type": "database", "x": 550, "y": 280, "status": "healthy" }
  ],
  "edges": [
    { "from": "gateway", "to": "api", "animated": true },
    { "from": "api", "to": "cache", "animated": true },
    { "from": "api", "to": "db", "animated": true },
    { "from": "cache", "to": "db", "animated": false }
  ],
  "events": [
    {
      "id": "evt-memory",
      "timestamp": 15,
      "type": "alert",
      "severity": "medium",
      "title": "High Memory Usage",
      "description": "Redis memory usage above 80%",
      "affectedNodes": ["cache"]
    },
    {
      "id": "evt-cache-fail",
      "timestamp": 45,
      "type": "failure",
      "severity": "high",
      "title": "Cache Connection Pool Exhausted",
      "description": "Connection timeouts to Redis",
      "affectedNodes": ["cache"]
    },
    {
      "id": "evt-cascade",
      "timestamp": 50,
      "type": "cascade",
      "severity": "high",
      "title": "Database Connection Surge",
      "description": "Cache bypass causes 10x database queries",
      "affectedNodes": ["db"]
    },
    {
      "id": "evt-recovery",
      "timestamp": 140,
      "type": "recovery",
      "severity": "info",
      "title": "Cache Restarted",
      "description": "Redis service recovered",
      "affectedNodes": ["cache"]
    }
  ],
  "narrative": {
    "executiveSummary": "Redis cache failure caused database overload, leading to 90% increase in API latency for 95 seconds.",
    "technicalSummary": "Memory leak in Redis client caused connection pool exhaustion. Without cache, API requests bypassed to database, causing 10x increase in database load and connection saturation.",
    "rootCause": "Memory leak in connection pool client library not releasing connections on timeout",
    "actions": [
      "Upgrade Redis client library to patched version",
      "Implement connection pool monitoring and alerts",
      "Add circuit breaker pattern for cache failures",
      "Load test to verify connection pool limits"
    ],
    "impactScore": 72
  }
}
```

## Tips & Best Practices

### Topology Design

1. **Layout**: Position components logically (top to bottom: external → gateway → services → data)
2. **Connections**: Connect related components; avoid overcrowding
3. **Variety**: Mix different node types to create realistic systems

### Event Design

1. **Realistic**: Model real-world failure modes
2. **Progressive**: Build up from alerts to cascading failures
3. **Recovery**: Include recovery events to show resilience
4. **Timing**: Space events realistically (not too fast or slow)

### Duration

- Short scenarios: 60-120 seconds (simple failures)
- Medium scenarios: 120-300 seconds (cascading failures)
- Long scenarios: 300+ seconds (slow-burn issues with recovery)

### Testing Your Scenario

1. **Import** your JSON file
2. **Play** the timeline to verify event sequence
3. **Check** that affected nodes highlight correctly
4. **Verify** narrative reveals at correct times
5. **Adjust** timings or descriptions as needed

## Troubleshooting

### Import Fails

- Ensure JSON is valid (use a JSON validator)
- Check all required fields are present
- Verify node IDs in edges/events match defined nodes
- Timestamp values must be within 0-duration range

### Nodes Don't Highlight

- Verify node IDs in `affectedNodes` match node `id` exactly
- Check event timestamps are within scenario duration
- Ensure events have correct `type` for desired highlighting

### Events Not Appearing

- Verify timestamps are in seconds, not milliseconds
- Check events are sorted by timestamp
- Ensure events array is not empty

## Support

For issues or questions, check the example scenarios in the app or consult the UI builder for field hints.
