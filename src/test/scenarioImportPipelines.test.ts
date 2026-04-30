import { describe, expect, it } from "vitest";
import { scenarios as builtInScenarios } from "@/data/scenarios";
import { importScenario } from "@/lib/scenarioIO";
import { importScenarioArtifactFromText } from "@/lib/scenarioImportPipelines";

const FIXED_IMPORT_TIME = Date.UTC(2026, 3, 23, 12, 0, 0);

function edgeLabelsFromScenario(
  scenario: Awaited<ReturnType<typeof importScenarioArtifactFromText>>["scenario"],
) {
  const labelByNodeId = new Map(scenario.nodes.map((node) => [node.id, node.label]));
  return scenario.edges.map(
    (edge) => `${labelByNodeId.get(edge.from)}->${labelByNodeId.get(edge.to)}`,
  );
}

describe("scenario import pipelines", () => {
  it("imports reusable scenario JSON artifacts", async () => {
    const result = await importScenarioArtifactFromText(
      JSON.stringify(builtInScenarios[0]),
      {
        fileName: "supply-chain.json",
        now: FIXED_IMPORT_TIME,
      },
    );

    expect(result.pipeline).toBe("scenario-json");
    expect(result.scenario.name).toBe(builtInScenarios[0].name);
    expect(result.scenario.id).not.toBe(builtInScenarios[0].id);
    expect(result.scenario.events).toHaveLength(builtInScenarios[0].events.length);
  });

  it("imports Kubernetes YAML manifests into topology nodes and edges", async () => {
    const yaml = `
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: public
spec:
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web-service
                port:
                  number: 80
---
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  selector:
    app: web
  ports:
    - port: 80
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: web-sa
---
apiVersion: v1
kind: Secret
metadata:
  name: web-secret
type: Opaque
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      serviceAccountName: web-sa
      containers:
        - name: api
          image: nginx:1.27
          envFrom:
            - secretRef:
                name: web-secret
`;

    const result = await importScenarioArtifactFromText(yaml, {
      fileName: "cluster-manifests.yaml",
      now: FIXED_IMPORT_TIME,
    });

    expect(result.pipeline).toBe("kubernetes-manifest");
    expect(result.summary).toContain("Imported 5 Kubernetes resources");
    expect(result.scenario.name).toBe("Kubernetes Import: default");
    expect(result.scenario.nodes.map((node) => node.label)).toEqual(
      expect.arrayContaining(["public", "web-service", "web-api", "web-sa", "web-secret"]),
    );
    expect(edgeLabelsFromScenario(result.scenario)).toEqual(
      expect.arrayContaining([
        "public->web-service",
        "web-service->web-api",
        "web-api->web-sa",
        "web-api->web-secret",
      ]),
    );
  });

  it("imports Terraform JSON plans into dependency graphs", async () => {
    const terraformPlan = {
      format_version: "1.2",
      configuration: {
        root_module: {
          resources: [
            {
              address: "aws_lb.public",
              type: "aws_lb",
              name: "public",
            },
            {
              address: "aws_lambda_function.api",
              type: "aws_lambda_function",
              name: "api",
              depends_on: ["aws_lb.public"],
            },
            {
              address: "aws_db_instance.primary",
              type: "aws_db_instance",
              name: "primary",
              depends_on: ["aws_lambda_function.api"],
            },
          ],
        },
      },
      resource_changes: [
        {
          address: "aws_db_instance.primary",
          type: "aws_db_instance",
          name: "primary",
          change: {
            actions: ["update"],
          },
        },
      ],
    };

    const result = await importScenarioArtifactFromText(
      JSON.stringify(terraformPlan),
      {
        fileName: "terraform-plan.json",
        now: FIXED_IMPORT_TIME,
      },
    );

    expect(result.pipeline).toBe("terraform-json");
    expect(result.summary).toContain("Imported 3 Terraform resources with 1 tracked plan changes.");
    expect(result.scenario.nodes.map((node) => node.label)).toEqual(
      expect.arrayContaining([
        "aws_lb.public",
        "aws_lambda_function.api",
        "aws_db_instance.primary",
      ]),
    );
    expect(edgeLabelsFromScenario(result.scenario)).toEqual(
      expect.arrayContaining([
        "aws_lambda_function.api->aws_lb.public",
        "aws_db_instance.primary->aws_lambda_function.api",
      ]),
    );
  });

  it("imports incident artifacts with timeline normalization", async () => {
    const incidentArtifact = {
      incident: {
        title: "Payments API outage",
        summary: "Failover instability caused sustained payment timeouts.",
        rootCause: "Primary database failover looped under load.",
        actions: ["Stabilize failover policy", "Rebuild replication lag alerting"],
      },
      services: [
        {
          name: "payments-api",
          type: "api",
          dependencies: ["postgres"],
        },
        {
          name: "postgres",
          type: "database",
        },
      ],
      timeline: [
        {
          timestamp: "2026-04-21T08:00:00Z",
          severity: "high",
          title: "Latency spike",
          description: "Payments API p99 exceeded the SLO.",
          service: "payments-api",
        },
        {
          timestamp: "2026-04-21T08:05:00Z",
          severity: "critical",
          title: "Database failover",
          description: "The primary database promoted a lagging standby.",
          service: "postgres",
        },
        {
          timestamp: "2026-04-21T08:12:00Z",
          severity: "medium",
          title: "Mitigation rollback",
          description: "Traffic was restored to the original primary.",
          service: "payments-api",
        },
      ],
    };

    const result = await importScenarioArtifactFromText(
      JSON.stringify(incidentArtifact),
      {
        fileName: "incident.json",
        now: FIXED_IMPORT_TIME,
      },
    );

    expect(result.pipeline).toBe("incident-artifact");
    expect(result.scenario.name).toBe("Payments API outage");
    expect(result.scenario.events.map((event) => event.timestamp)).toEqual([0, 300, 720]);
    expect(result.scenario.events.map((event) => event.type)).toEqual([
      "alert",
      "failure",
      "recovery",
    ]);
    expect(edgeLabelsFromScenario(result.scenario)).toContain(
      "payments-api->postgres",
    );
  });

  it("routes file-based imports through the artifact pipeline", async () => {
    const file = new File(
      [
        JSON.stringify({
          services: [{ name: "edge-gateway", type: "gateway" }],
          timeline: [{ timestamp: 0, title: "Edge alert", service: "edge-gateway" }],
        }),
      ],
      "incident-artifact.json",
      { type: "application/json" },
    );

    const result = await importScenario(file);

    expect(result.pipeline).toBe("incident-artifact");
    expect(result.scenario.nodes).toHaveLength(1);
    expect(result.scenario.events).toHaveLength(1);
  });
});
