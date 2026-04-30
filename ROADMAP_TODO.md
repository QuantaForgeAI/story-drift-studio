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

- [x] Add a backend data model for scenarios, drafts, published versions, and replay snapshots.
- [x] Add authentication, organization membership, and role-based access control.
- [x] Add audit logs for scenario creation, edits, imports, deletes, and playback sessions.
- [x] Add shareable permalinks and version history for scenarios.
- [x] Add collaboration-safe editing flows and conflict handling.
- [x] Add structured server-side logging and error reporting.

## Phase 3: Enterprise Platform Readiness

- [x] Add tenant isolation and production-grade storage strategy.
- [x] Add SSO/OIDC integration for enterprise customers.
- [x] Add observability for client and server behavior, with clear caveats for browser telemetry maturity.
- [x] Add performance budgets and release gates.
- [x] Add accessibility hardening aligned with WCAG 2.2.
- [x] Add security verification workflows aligned with OWASP ASVS.
- [x] Add CI quality gates for tests, bundle health, and release readiness.

## Phase 4: Developer Wow Factor

- [x] Add scenario diffing and replay comparison.
- [x] Add import pipelines from real system inputs such as Kubernetes, Terraform, or incident artifacts.
- [x] Add richer export flows for reports, postmortems, and stakeholder playback links.
- [x] Add a premium documentation/storytelling layer with architecture docs, examples, and launch assets.
- [x] Add Storybook-driven visual coverage for the design system and major simulator states.
- [x] Add collaborative and presentation-grade UX polish for demos and workshops.
