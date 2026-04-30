# System Drift Simulator

System Drift Simulator is a private Vite + React + TypeScript application for building and replaying incident scenarios over a live topology and timeline interface.

This repo is based on a Vite + shadcn-style React starter and includes a UI surface for incident modeling, scenario imports, and a Storybook-driven component workbench.

## What This Project Contains

- A Vite React application with Tailwind CSS and Radix UI primitives
- Incident scenario modeling around topology, timelines, and workspace panels
- Sample import support for Kubernetes manifests, Terraform plans, and incident JSON
- A Storybook environment for UI development and component review
- Production-quality checks for linting, testing, building, storybook, and bundle budgets

## Documentation

- [Documentation Hub](./docs/README.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Example Gallery](./docs/EXAMPLE_GALLERY.md)
- [Launch Kit](./docs/LAUNCH_KIT.md)
- [Custom Scenario Guide](./CUSTOM_SCENARIO_GUIDE.md)

## Example Assets

- [Kubernetes import example](./examples/imports/kubernetes-checkout-platform.yaml)
- [Terraform import example](./examples/imports/terraform-edge-stack.plan.json)
- [Incident artifact example](./examples/imports/incident-payments-failover.json)
- [Native scenario JSON example](./examples/scenarios/api-cache-cascade.json)

## Local Development

```bash
npm install
npm run dev
npm run storybook
```

- `npm run dev` starts the Vite app locally
- `npm run storybook` starts the Storybook UI workbench on port `6006`

## Useful Scripts

```bash
npm run dev
npm run build
npm run build:dev
npm run preview
npm run test
npm run test:watch
npm run lint
npm run build-storybook
npm run performance:check
npm run release:gate
```

- `npm run release:gate` runs lint, tests, build, Storybook build, and performance checks in sequence.
- `npm run performance:check` validates the bundle against the configured performance budgets.

## Notes

- The actual package metadata is internal and the repository is configured as a private Vite app.
- The project uses React 18, Vite, Tailwind CSS, Storybook, and Vitest.
- The package name in `package.json` is `vite_react_shadcn_ts`.

## CI Quality Gates

This repo includes a release gate workflow that validates code quality before merge.

- installs dependencies with `npm ci`
- runs `npm run release:gate`
- generates a Storybook build and performance budget report

## Roadmap

Ongoing work and polish are tracked in [ROADMAP_TODO.md](./ROADMAP_TODO.md).
