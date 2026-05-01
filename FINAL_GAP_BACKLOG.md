# Final Gap Backlog

This backlog captures the next implementation work needed to turn System Drift Simulator into a Datadog-grade simulator hybrid.

## Priority order

1. Define the system state model
2. Make timeline drive everything
3. Turn topology into the truth layer
4. Build a reusable scenario schema
5. Add branching simulation
6. Reduce UI complexity

## 1. Define the system state model

Goal: Make the system state model the single source of truth.

Tasks:
- Define the canonical state shape for:
  - topology nodes and edges
  - node/service health
  - metric series and alert state
  - active timeline events and branch state
  - state diffs and drift metadata
  - decision support recommendations
- Implement the model in `src/lib/scenarioSchema.ts`.
- Refactor state mutations so they target the model, not UI-only props.
- Add unit tests covering state application and validation.

## 2. Make timeline drive everything

Goal: Use the timeline as the authoritative driver of replay state.

Tasks:
- Refactor `src/lib/simulation-core.ts` so the timeline produces derived state.
- Ensure `currentTime` determines:
  - active alerts
  - topology health state
  - metric anomalies
  - narrative status
  - branch availability
- Remove alternative playback state sources in UI components.
- Consolidate the timeline adapter in `src/hooks/useTimelineEngine.ts`.

## 3. Turn topology into the truth layer

Goal: Treat topology as the authoritative graph model behind the UI.

Tasks:
- Make topology state the root for event impact and failure propagation.
- Apply event effects directly to node and edge state in the model.
- Use the topology graph for trace flow and drill-down navigation.
- Keep `TopologyMap` as a renderer of topology state, not a state owner.

## 4. Build a reusable scenario schema

Goal: Create a schema that supports simulation, import, export, and validation.

Tasks:
- Add a reusable schema contract for:
  - scenario metadata
  - topology + dependency graph
  - timeline events
  - metrics and alert definitions
  - branching paths
  - state diffs and drift data
  - decision support metadata
- Use `src/lib/scenarioSchema.ts` and `src/lib/scenarioBackendModels.ts`.
- Update import pipelines and sample scenarios to conform.
- Add runtime validation and tests.

## 5. Add branching simulation

Goal: Let operators explore alternate incident outcomes.

Tasks:
- Model branch points in the timeline.
- Add branch decisions to the scenario state.
- Implement branch selection in the playback UI.
- Enable side-by-side comparison of alternate paths.
- Persist chosen branch history in replay snapshots.

## 6. Reduce UI complexity

Goal: Simplify the UI to the core simulation story.

Tasks:
- Reduce the surface to one primary playback experience.
- Collapse secondary panels into contextual overlays.
- Lazy-load non-core dialogs and investigatory views.
- Keep the main view tightly aligned to timeline + topology + decision support.
- Remove or defer features that do not directly support the simulator truth model.

## Repo-level tasks

- [ ] Add `src/lib/scenarioSchema.ts` as the canonical state model definition.
- [ ] Refactor `src/lib/simulation-core.ts` to derive all state from timeline events.
- [ ] Create a clear topology truth layer and transition `TopologyMap` to a renderer-only component.
- [ ] Build a reusable scenario schema and update import/export flows.
- [ ] Add branching timeline support and branch decision recording.
- [ ] Simplify the main playback UI and align it to the core state model.
- [ ] Add tests for timeline-derived state, branch choices, and schema validation.
- [ ] Document the state model and developer workflow in `FINAL_GAP_BACKLOG.md`.
