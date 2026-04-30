import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importScenarioArtifactFromText } from "@/lib/scenarioImportPipelines";

function readExampleFile(...segments: string[]) {
  return readFileSync(path.resolve(process.cwd(), ...segments), "utf8");
}

describe("repository example artifacts", () => {
  it("keeps the Kubernetes example importable", async () => {
    const result = await importScenarioArtifactFromText(
      readExampleFile("examples", "imports", "kubernetes-checkout-platform.yaml"),
      {
        fileName: "kubernetes-checkout-platform.yaml",
        now: Date.UTC(2026, 3, 24),
      },
    );

    expect(result.pipeline).toBe("kubernetes-manifest");
    expect(result.scenario.nodes.length).toBeGreaterThanOrEqual(6);
    expect(result.summary).toContain("Kubernetes resources");
  });

  it("keeps the Terraform example importable", async () => {
    const result = await importScenarioArtifactFromText(
      readExampleFile("examples", "imports", "terraform-edge-stack.plan.json"),
      {
        fileName: "terraform-edge-stack.plan.json",
        now: Date.UTC(2026, 3, 24),
      },
    );

    expect(result.pipeline).toBe("terraform-json");
    expect(result.scenario.nodes.length).toBe(4);
    expect(result.summary).toContain("Terraform resources");
  });

  it("keeps the incident example importable", async () => {
    const result = await importScenarioArtifactFromText(
      readExampleFile("examples", "imports", "incident-payments-failover.json"),
      {
        fileName: "incident-payments-failover.json",
        now: Date.UTC(2026, 3, 24),
      },
    );

    expect(result.pipeline).toBe("incident-artifact");
    expect(result.scenario.events.length).toBe(4);
    expect(result.scenario.name).toBe("Payments Database Failover Loop");
  });

  it("keeps the native scenario example importable", async () => {
    const result = await importScenarioArtifactFromText(
      readExampleFile("examples", "scenarios", "api-cache-cascade.json"),
      {
        fileName: "api-cache-cascade.json",
        now: Date.UTC(2026, 3, 24),
      },
    );

    expect(result.pipeline).toBe("scenario-json");
    expect(result.scenario.id).not.toBe("example-api-cache-cascade");
    expect(result.scenario.events.length).toBe(4);
  });
});
