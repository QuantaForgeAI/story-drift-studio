# System Drift Simulator Roadmap

This checklist tracks the recommendations needed to move the project from polished demo to production-grade product.

## Phase 1: Core Hardening

- [x] Extract a deterministic `simulation-core` module from the React hook layer.
- [x] Write real automated tests for the simulation engine.
- [x] Introduce strict scenario schema validation with runtime parsing.
- [x] Add scenario schema versioning and legacy import migration.
- [x] Replace fragile import/export flows with safer error-handled utilities.
- [x] Persist custom scenarios locally across reloads.
- [x] Add resilient error boundaries and remove blocking browser alerts.
- [x] Run lint, unit tests, and production build before closing the phase.

## Phase 2: Product Foundations

- [ ] Add a backend data model for scenarios, drafts, published versions, and replay snapshots.
- [ ] Add authentication, organization membership, and role-based access control.
- [ ] Add audit logs for scenario creation, edits, imports, deletes, and playback sessions.
- [ ] Add shareable permalinks and version history for scenarios.
- [ ] Add collaboration-safe editing flows and conflict handling.
- [ ] Add structured server-side logging and error reporting.

## Phase 3: Enterprise Platform Readiness

- [ ] Add tenant isolation and production-grade storage strategy.
- [ ] Add SSO/OIDC integration for enterprise customers.
- [ ] Add observability for client and server behavior, with clear caveats for browser telemetry maturity.
- [ ] Add performance budgets and release gates.
- [ ] Add accessibility hardening aligned with WCAG 2.2.
- [ ] Add security verification workflows aligned with OWASP ASVS.
- [ ] Add CI quality gates for tests, bundle health, and release readiness.

## Phase 4: Developer Wow Factor

- [ ] Add scenario diffing and replay comparison.
- [ ] Add import pipelines from real system inputs such as Kubernetes, Terraform, or incident artifacts.
- [ ] Add richer export flows for reports, postmortems, and stakeholder playback links.
- [ ] Add a premium documentation/storytelling layer with architecture docs, examples, and launch assets.
- [ ] Add Storybook-driven visual coverage for the design system and major simulator states.
- [ ] Add collaborative and presentation-grade UX polish for demos and workshops.
