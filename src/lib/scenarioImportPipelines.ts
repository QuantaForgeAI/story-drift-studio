import type {
  IncidentNarrative,
  Scenario,
  Severity,
  TimelineEvent,
  TopologyEdge,
  TopologyNode,
} from "@/data/scenarios";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";
import { parseScenario } from "@/lib/scenarioSchema";
import {
  getTopologyNodeDefinition,
  type TopologyNodeType,
} from "@/lib/topologyNodes";

export type ScenarioImportPipeline =
  | "scenario-json"
  | "kubernetes-manifest"
  | "terraform-json"
  | "incident-artifact";

export interface ScenarioImportResult {
  scenario: Scenario;
  pipeline: ScenarioImportPipeline;
  summary: string;
}

interface ImportContext {
  fileName: string;
  now?: number;
}

interface NodeDraft {
  key: string;
  label: string;
  type: TopologyNodeType;
  status?: TopologyNode["status"];
}

interface K8sManifest {
  apiVersion?: string;
  kind?: string;
  metadata?: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: Record<string, unknown>;
  data?: Record<string, unknown>;
  stringData?: Record<string, unknown>;
  [key: string]: unknown;
}

interface TerraformResourceReference {
  address: string;
  type: string;
  name: string;
  label: string;
  nodeType: TopologyNodeType;
  dependsOn: string[];
}

const DEFAULT_IMPORT_DURATION_SECONDS = 180;
const MAX_IMPORT_EVENT_COUNT = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "import";
}

function createImportedScenarioId(
  pipeline: ScenarioImportPipeline,
  fileName: string,
  now = Date.now(),
) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${pipeline}-${slugify(baseName)}-${now}`;
}

function fileTitleFromName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function dedupeEdges(edges: TopologyEdge[]) {
  const seen = new Set<string>();

  return edges.filter((edge) => {
    const key = `${edge.from}->${edge.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function materializeNodes(nodeDrafts: NodeDraft[]) {
  const groups = new Map<string, NodeDraft[]>();

  for (const draft of nodeDrafts) {
    const group = getTopologyNodeDefinition(draft.type).group;
    const bucket = groups.get(group) ?? [];
    bucket.push(draft);
    groups.set(group, bucket);
  }

  const orderedGroups = [
    "Clients & Edge",
    "Compute & Apps",
    "Data & Messaging",
    "Control & Ops",
    "Integrations",
  ];
  const nodes: TopologyNode[] = [];

  orderedGroups.forEach((group, groupIndex) => {
    const bucket = (groups.get(group) ?? []).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
    bucket.forEach((draft, index) => {
      const wrapColumn = Math.floor(index / 4);
      const row = index % 4;
      nodes.push({
        id: draft.key,
        label: draft.label,
        type: draft.type,
        status: draft.status ?? "healthy",
        x: 120 + groupIndex * 190 + wrapColumn * 70,
        y: 90 + row * 115,
      });
    });
  });

  return nodes;
}

function inferSeverityFromNodeTypes(nodeTypes: TopologyNodeType[]): Severity {
  if (
    nodeTypes.some((type) => type === "database" || type === "security") &&
    nodeTypes.some((type) => type === "gateway" || type === "load-balancer")
  ) {
    return "high";
  }

  if (nodeTypes.some((type) => type === "database" || type === "queue")) {
    return "medium";
  }

  return "low";
}

function inferNodeTypeFromName(
  name: string,
  fallback: TopologyNodeType = "service",
): TopologyNodeType {
  const normalized = name.toLowerCase();

  if (/(ingress|gateway|kong|traefik|apigw|api-gateway)/.test(normalized)) {
    return "gateway";
  }

  if (/(loadbalancer|load-balancer|alb|elb)\b/.test(normalized)) {
    return "load-balancer";
  }

  if (/(postgres|mysql|mariadb|mongo|cassandra|oracle|sql|database|\bdb\b|rds)/.test(normalized)) {
    return "database";
  }

  if (/(redis|memcache|cache)/.test(normalized)) {
    return "cache";
  }

  if (/(queue|rabbit|sqs|servicebus|worker-queue)/.test(normalized)) {
    return "queue";
  }

  if (/(stream|kafka|kinesis|eventhub|pubsub|topic)/.test(normalized)) {
    return "stream";
  }

  if (/(bucket|blob|storage|volume|efs|disk|pvc|filesystem|s3)/.test(normalized)) {
    return "storage";
  }

  if (/(auth|identity|iam|oidc|oauth|sso|keycloak|serviceaccount|entra)/.test(normalized)) {
    return "identity";
  }

  if (/(waf|firewall|vault|secret|policy|networkpolicy|falco|siem|guard)/.test(normalized)) {
    return "security";
  }

  if (/(grafana|prometheus|datadog|otel|monitor|log|trace|metric|observability)/.test(normalized)) {
    return "observability";
  }

  if (/(github|gitlab|jenkins|tekton|argo|flux|pipeline|ci\/cd|cicd|ci-cd)/.test(normalized)) {
    return "ci-cd";
  }

  if (/(lambda|function|cloudrun|serverless|faas)/.test(normalized)) {
    return "serverless";
  }

  if (/(worker|cron|job|scheduler)/.test(normalized)) {
    return "worker";
  }

  if (/(model|inference|vector|embedding|\bml\b|\bai\b)/.test(normalized)) {
    return "ai";
  }

  if (/(external|partner|third-party|vendor|saas|cdn)/.test(normalized)) {
    return "external";
  }

  if (/(compute|node|vm|instance)/.test(normalized)) {
    return "compute";
  }

  return fallback;
}

function createSyntheticTimeline(
  title: string,
  nodeIds: string[],
  severity: Severity,
  importedSummary: string,
): TimelineEvent[] {
  const primaryNodeIds = nodeIds.slice(0, 4);
  const impactedNodeIds = nodeIds.slice(0, 2);
  const duration = DEFAULT_IMPORT_DURATION_SECONDS;
  const severityByIndex: Severity[] =
    severity === "high" || severity === "critical"
      ? ["info", "medium", "high", "high", "low"]
      : ["info", "low", "medium", "medium", "info"];

  return [
    {
      id: "evt-import-baseline",
      timestamp: 0,
      type: "drift",
      severity: severityByIndex[0],
      title: `${title} baseline imported`,
      description: importedSummary,
      affectedNodes: primaryNodeIds,
      stateDiff: [
        {
          field: "import.pipeline",
          before: "manual topology",
          after: title,
        },
      ],
    },
    {
      id: "evt-import-routing",
      timestamp: 25,
      type: "alert",
      severity: severityByIndex[1],
      title: "Dependency path review",
      description:
        "Generated topology highlights the primary traffic and dependency path. Review the edges before using this as a source-of-truth incident model.",
      affectedNodes: primaryNodeIds,
    },
    {
      id: "evt-import-pressure",
      timestamp: 60,
      type: "failure",
      severity: severityByIndex[2],
      title: "Core workload under pressure",
      description:
        "Generated timeline assumes the central workload tier becomes degraded first, creating pressure on its downstream dependencies.",
      affectedNodes: impactedNodeIds,
    },
    {
      id: "evt-import-cascade",
      timestamp: 110,
      type: "cascade",
      severity: severityByIndex[3],
      title: "Downstream impact spreads",
      description:
        "Use this placeholder cascade event as a starting point, then tailor the affected nodes and narrative to match the real failure mode from your environment.",
      affectedNodes: primaryNodeIds,
    },
    {
      id: "evt-import-recovery",
      timestamp: duration,
      type: "recovery",
      severity: severityByIndex[4],
      title: "Recovery rollout planned",
      description:
        "Finish the imported scenario by replacing this scaffolding with the actual mitigation steps, rollout timing, and recovery validation.",
      affectedNodes: impactedNodeIds,
    },
  ].slice(0, MAX_IMPORT_EVENT_COUNT);
}

function buildImportedScenario(
  pipeline: ScenarioImportPipeline,
  fileName: string,
  name: string,
  subtitle: string,
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  narrative: IncidentNarrative,
  summary: string,
  events?: TimelineEvent[],
  severity?: Severity,
  now?: number,
) {
  const resolvedSeverity =
    severity ?? inferSeverityFromNodeTypes(nodes.map((node) => node.type));
  const resolvedEvents =
    events && events.length > 0
      ? events
      : createSyntheticTimeline(name, nodes.map((node) => node.id), resolvedSeverity, summary);

  return parseScenario({
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id: createImportedScenarioId(pipeline, fileName, now),
    name,
    subtitle,
    severity: resolvedSeverity,
    duration: Math.max(
      DEFAULT_IMPORT_DURATION_SECONDS,
      resolvedEvents.at(-1)?.timestamp ?? DEFAULT_IMPORT_DURATION_SECONDS,
    ),
    nodes,
    edges: dedupeEdges(edges),
    events: resolvedEvents,
    narrative,
  });
}

function getPipelineLabel(pipeline: ScenarioImportPipeline) {
  switch (pipeline) {
    case "scenario-json":
      return "Scenario JSON";
    case "kubernetes-manifest":
      return "Kubernetes manifest";
    case "terraform-json":
      return "Terraform JSON";
    case "incident-artifact":
      return "Incident artifact";
    default:
      return pipeline;
  }
}

function isTerraformCandidate(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    ("planned_values" in value ||
      "resource_changes" in value ||
      "configuration" in value ||
      "resource" in value)
  );
}

function isIncidentArtifactCandidate(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    (Array.isArray(value.timeline) ||
      Array.isArray(value.events) ||
      Array.isArray(value.alerts) ||
      Array.isArray(value.services) ||
      isRecord(value.incident))
  );
}

function isKubernetesManifest(value: unknown): value is K8sManifest {
  return (
    isRecord(value) &&
    typeof value.kind === "string" &&
    typeof value.apiVersion === "string"
  );
}

function normalizeNamespace(manifest: K8sManifest) {
  return manifest.metadata?.namespace ?? "default";
}

function manifestDisplayName(manifest: K8sManifest) {
  const namespace = normalizeNamespace(manifest);
  const name = manifest.metadata?.name ?? "resource";
  return namespace === "default" ? name : `${namespace}/${name}`;
}

function createManifestKey(kind: string, namespace: string, name: string) {
  return `${slugify(kind)}-${slugify(namespace)}-${slugify(name)}`;
}

function labelsMatch(
  selector: Record<string, string>,
  labels: Record<string, string>,
) {
  const entries = Object.entries(selector);
  return entries.length > 0 && entries.every(([key, value]) => labels[key] === value);
}

function parseReferencedServiceNames(spec: Record<string, unknown>) {
  const serviceNames = new Set<string>();
  const rules = asArray<Record<string, unknown>>(spec.rules);

  for (const rule of rules) {
    const http = isRecord(rule.http) ? rule.http : null;
    if (!http) continue;
    const paths = asArray<Record<string, unknown>>(http.paths);
    for (const path of paths) {
      const backend = isRecord(path.backend) ? path.backend : null;
      const service = backend && isRecord(backend.service) ? backend.service : null;
      const serviceName = service ? asString(service.name) : "";
      if (serviceName) {
        serviceNames.add(serviceName);
      }
    }
  }

  const defaultBackend = isRecord(spec.defaultBackend) ? spec.defaultBackend : null;
  const defaultService =
    defaultBackend && isRecord(defaultBackend.service) ? defaultBackend.service : null;
  if (defaultService) {
    const serviceName = asString(defaultService.name);
    if (serviceName) {
      serviceNames.add(serviceName);
    }
  }

  return Array.from(serviceNames);
}

function getWorkloadLabels(manifest: K8sManifest) {
  const metadataLabels = isRecord(manifest.metadata?.labels)
    ? (manifest.metadata?.labels as Record<string, string>)
    : {};
  const template = isRecord(manifest.spec?.template) ? manifest.spec?.template : null;
  const templateMetadata = template && isRecord(template.metadata) ? template.metadata : null;
  const templateLabels =
    templateMetadata && isRecord(templateMetadata.labels)
      ? (templateMetadata.labels as Record<string, string>)
      : {};

  return {
    ...metadataLabels,
    ...templateLabels,
  };
}

function extractSecretReferences(manifest: K8sManifest) {
  const references = new Set<string>();
  const spec = isRecord(manifest.spec) ? manifest.spec : {};
  const template = isRecord(spec.template) ? spec.template : null;
  const podSpec =
    template && isRecord(template.spec)
      ? template.spec
      : isRecord(spec.jobTemplate) &&
          isRecord((spec.jobTemplate as Record<string, unknown>).spec) &&
          isRecord(((spec.jobTemplate as Record<string, unknown>).spec as Record<string, unknown>).template)
        ? ((((spec.jobTemplate as Record<string, unknown>).spec as Record<string, unknown>).template as Record<string, unknown>).spec as Record<string, unknown>) ?? {}
        : spec;

  const containers = [
    ...asArray<Record<string, unknown>>(podSpec.containers),
    ...asArray<Record<string, unknown>>(podSpec.initContainers),
  ];

  for (const container of containers) {
    for (const env of asArray<Record<string, unknown>>(container.env)) {
      const valueFrom = isRecord(env.valueFrom) ? env.valueFrom : null;
      const secretKeyRef =
        valueFrom && isRecord(valueFrom.secretKeyRef) ? valueFrom.secretKeyRef : null;
      const secretName = secretKeyRef ? asString(secretKeyRef.name) : "";
      if (secretName) {
        references.add(secretName);
      }
    }

    for (const envFrom of asArray<Record<string, unknown>>(container.envFrom)) {
      const secretRef = isRecord(envFrom.secretRef) ? envFrom.secretRef : null;
      const secretName = secretRef ? asString(secretRef.name) : "";
      if (secretName) {
        references.add(secretName);
      }
    }
  }

  for (const imagePullSecret of asArray<Record<string, unknown>>(podSpec.imagePullSecrets)) {
    const secretName = asString(imagePullSecret.name);
    if (secretName) {
      references.add(secretName);
    }
  }

  return Array.from(references);
}

function extractPersistentVolumeClaims(manifest: K8sManifest) {
  const claims = new Set<string>();
  const spec = isRecord(manifest.spec) ? manifest.spec : {};
  const template = isRecord(spec.template) ? spec.template : null;
  const podSpec =
    template && isRecord(template.spec) ? template.spec : spec;

  for (const volume of asArray<Record<string, unknown>>(podSpec.volumes)) {
    const pvc = isRecord(volume.persistentVolumeClaim)
      ? volume.persistentVolumeClaim
      : null;
    const claimName = pvc ? asString(pvc.claimName) : "";
    if (claimName) {
      claims.add(claimName);
    }
  }

  for (const templateClaim of asArray<Record<string, unknown>>(spec.volumeClaimTemplates)) {
    const metadata = isRecord(templateClaim.metadata) ? templateClaim.metadata : null;
    const claimName = metadata ? asString(metadata.name) : "";
    if (claimName) {
      claims.add(claimName);
    }
  }

  return Array.from(claims);
}

function manifestNodeType(manifest: K8sManifest): TopologyNodeType | null {
  const kind = asString(manifest.kind);
  const name = asString(manifest.metadata?.name);

  switch (kind) {
    case "Ingress":
    case "Gateway":
      return "gateway";
    case "Service": {
      const serviceType = asString(manifest.spec?.type);
      if (serviceType === "LoadBalancer") {
        return "load-balancer";
      }
      if (serviceType === "ExternalName") {
        return "external";
      }
      return inferNodeTypeFromName(name, "service");
    }
    case "Deployment":
    case "StatefulSet":
    case "DaemonSet":
    case "ReplicaSet":
    case "Pod":
      return inferNodeTypeFromName(name, "service");
    case "Job":
    case "CronJob":
      return inferNodeTypeFromName(name, "worker");
    case "PersistentVolumeClaim":
      return "storage";
    case "ServiceAccount":
      return "identity";
    case "Secret":
      return "security";
    case "NetworkPolicy":
      return "security";
    default:
      return null;
  }
}

function importKubernetesManifests(
  manifests: K8sManifest[],
  context: ImportContext,
): ScenarioImportResult {
  const resourceManifests = manifests.filter(isKubernetesManifest);
  if (resourceManifests.length === 0) {
    throw new Error("No Kubernetes resources were found in the provided manifest.");
  }

  const nodes = new Map<string, NodeDraft>();
  const edges: TopologyEdge[] = [];
  const services = new Map<string, K8sManifest>();
  const workloads = new Map<string, K8sManifest>();
  const serviceAccounts = new Map<string, K8sManifest>();
  const networkPolicies = new Map<string, K8sManifest>();
  const secrets = new Map<string, K8sManifest>();
  const persistentVolumeClaims = new Map<string, K8sManifest>();

  for (const manifest of resourceManifests) {
    const kind = asString(manifest.kind);
    const namespace = normalizeNamespace(manifest);
    const name = asString(manifest.metadata?.name);
    if (!name || !kind) continue;

    const nodeType = manifestNodeType(manifest);
    if (nodeType) {
      nodes.set(
        createManifestKey(kind, namespace, name),
        {
          key: createManifestKey(kind, namespace, name),
          label: manifestDisplayName(manifest),
          type: nodeType,
          status: "healthy",
        },
      );
    }

    if (kind === "Service") {
      services.set(`${namespace}/${name}`, manifest);
    } else if (
      ["Deployment", "StatefulSet", "DaemonSet", "ReplicaSet", "Pod", "Job", "CronJob"].includes(
        kind,
      )
    ) {
      workloads.set(`${namespace}/${name}`, manifest);
    } else if (kind === "ServiceAccount") {
      serviceAccounts.set(`${namespace}/${name}`, manifest);
    } else if (kind === "NetworkPolicy") {
      networkPolicies.set(`${namespace}/${name}`, manifest);
    } else if (kind === "Secret") {
      secrets.set(`${namespace}/${name}`, manifest);
    } else if (kind === "PersistentVolumeClaim") {
      persistentVolumeClaims.set(`${namespace}/${name}`, manifest);
    }
  }

  for (const manifest of resourceManifests) {
    const kind = asString(manifest.kind);
    const namespace = normalizeNamespace(manifest);
    const name = asString(manifest.metadata?.name);
    if (!name || !kind) continue;

    const sourceId = createManifestKey(kind, namespace, name);

    if (kind === "Ingress" || kind === "Gateway") {
      const serviceNames = parseReferencedServiceNames(
        (isRecord(manifest.spec) ? manifest.spec : {}) as Record<string, unknown>,
      );
      serviceNames.forEach((serviceName) => {
        const target = services.get(`${namespace}/${serviceName}`);
        if (!target) return;
        edges.push({
          from: sourceId,
          to: createManifestKey("Service", namespace, serviceName),
          animated: true,
        });
      });
    }

    if (kind === "Service") {
      const selector = isRecord(manifest.spec?.selector)
        ? (manifest.spec?.selector as Record<string, string>)
        : {};
      for (const [workloadKey, workloadManifest] of workloads.entries()) {
        const workloadLabels = getWorkloadLabels(workloadManifest);
        if (labelsMatch(selector, workloadLabels)) {
          const workloadName = workloadKey.split("/")[1] ?? workloadKey;
          edges.push({
            from: sourceId,
            to: createManifestKey(
              asString(workloadManifest.kind),
              normalizeNamespace(workloadManifest),
              workloadName,
            ),
          });
        }
      }
    }

    if (workloads.has(`${namespace}/${name}`)) {
      const workloadSpec =
        isRecord(manifest.spec?.template) && isRecord(manifest.spec?.template.spec)
          ? (manifest.spec?.template.spec as Record<string, unknown>)
          : manifest.spec;
      const serviceAccountName = asString(workloadSpec?.serviceAccountName);
      if (serviceAccountName && serviceAccounts.has(`${namespace}/${serviceAccountName}`)) {
        edges.push({
          from: sourceId,
          to: createManifestKey("ServiceAccount", namespace, serviceAccountName),
        });
      }

      for (const secretName of extractSecretReferences(manifest)) {
        const secretManifest = secrets.get(`${namespace}/${secretName}`);
        if (!secretManifest) continue;
        edges.push({
          from: sourceId,
          to: createManifestKey("Secret", namespace, secretName),
        });
      }

      for (const claimName of extractPersistentVolumeClaims(manifest)) {
        const pvcManifest = persistentVolumeClaims.get(`${namespace}/${claimName}`);
        if (!pvcManifest) continue;
        edges.push({
          from: sourceId,
          to: createManifestKey("PersistentVolumeClaim", namespace, claimName),
        });
      }
    }

    if (kind === "NetworkPolicy") {
      const podSelector = isRecord(manifest.spec?.podSelector)
        ? (manifest.spec?.podSelector as Record<string, unknown>)
        : null;
      const matchLabels = podSelector && isRecord(podSelector.matchLabels)
        ? (podSelector.matchLabels as Record<string, string>)
        : {};
      if (Object.keys(matchLabels).length > 0) {
        for (const [workloadKey, workloadManifest] of workloads.entries()) {
          const workloadLabels = getWorkloadLabels(workloadManifest);
          if (labelsMatch(matchLabels, workloadLabels)) {
            const workloadName = workloadKey.split("/")[1] ?? workloadKey;
            edges.push({
              from: sourceId,
              to: createManifestKey(
                asString(workloadManifest.kind),
                normalizeNamespace(workloadManifest),
                workloadName,
              ),
            });
          }
        }
      }
    }
  }

  const nodeList = materializeNodes(Array.from(nodes.values()));
  if (nodeList.length === 0) {
    throw new Error("No supported Kubernetes resources could be converted into topology nodes.");
  }

  const namespaces = Array.from(
    new Set(resourceManifests.map((manifest) => normalizeNamespace(manifest))),
  );
  const title =
    namespaces.length === 1
      ? `Kubernetes Import: ${namespaces[0]}`
      : `Kubernetes Import: ${fileTitleFromName(context.fileName)}`;
  const summary = `Imported ${resourceManifests.length} Kubernetes resources across ${namespaces.length} namespace${namespaces.length === 1 ? "" : "s"}.`;
  const dataNodes = nodeList.filter((node) =>
    ["database", "cache", "storage", "queue", "stream"].includes(node.type),
  );

  return {
    pipeline: "kubernetes-manifest",
    summary,
    scenario: buildImportedScenario(
      "kubernetes-manifest",
      context.fileName,
      title,
      `${resourceManifests.length} resources converted into a scenario scaffold from live cluster manifests.`,
      nodeList,
      edges,
      {
        executiveSummary: `${summary} The simulator generated a topology-first incident scenario scaffold from the provided manifests.`,
        technicalSummary:
          "Ingress, services, workloads, service accounts, secrets, PVCs, and network policies were converted into nodes and dependency edges. The generated event timeline is intentionally scaffolded and should be tailored to the real failure path in this environment.",
        rootCause:
          "This scenario was generated from Kubernetes manifests. Replace the placeholder failure chain with the actual drift, outage, or incident progression you want to model.",
        actions: [
          "Review the generated workload and service edges against the cluster architecture",
          "Replace the scaffolded timeline events with the real incident sequence",
          "Validate whether imported security and storage dependencies should stay in scope",
        ],
        impactScore: dataNodes.length > 0 ? 68 : 54,
      },
      summary,
      undefined,
      undefined,
      context.now,
    ),
  };
}

function collectTerraformConfigurationResources(
  module: Record<string, unknown>,
  resources: TerraformResourceReference[],
) {
  for (const resource of asArray<Record<string, unknown>>(module.resources)) {
    const address = asString(resource.address) || `${asString(resource.type)}.${asString(resource.name)}`;
    const references = new Set<string>(asArray<string>(resource.depends_on));

    const stack = [resource.expressions];
    while (stack.length > 0) {
      const current = stack.pop();
      if (Array.isArray(current)) {
        current.forEach((item) => stack.push(item));
      } else if (isRecord(current)) {
        if (Array.isArray(current.references)) {
          current.references.forEach((value) => {
            if (typeof value === "string") {
              references.add(value);
            }
          });
        }
        Object.values(current).forEach((value) => stack.push(value));
      }
    }

    resources.push({
      address,
      type: asString(resource.type),
      name: asString(resource.name) || address,
      label: address,
      nodeType: inferNodeTypeFromName(
        `${asString(resource.type)} ${asString(resource.name)} ${address}`,
        "compute",
      ),
      dependsOn: Array.from(references),
    });
  }

  for (const childModule of asArray<Record<string, unknown>>(module.module_calls)) {
    if (isRecord(childModule.module)) {
      collectTerraformConfigurationResources(childModule.module, resources);
    }
  }
}

function collectTerraformPlannedResources(
  module: Record<string, unknown>,
  resources: TerraformResourceReference[],
) {
  for (const resource of asArray<Record<string, unknown>>(module.resources)) {
    const address = asString(resource.address) || `${asString(resource.type)}.${asString(resource.name)}`;
    resources.push({
      address,
      type: asString(resource.type),
      name: asString(resource.name) || address,
      label: address,
      nodeType: inferNodeTypeFromName(
        `${asString(resource.type)} ${asString(resource.name)} ${address}`,
        "compute",
      ),
      dependsOn: asArray<string>(resource.depends_on),
    });
  }

  for (const childModule of asArray<Record<string, unknown>>(module.child_modules)) {
    collectTerraformPlannedResources(childModule, resources);
  }
}

function collectTerraformResources(input: Record<string, unknown>) {
  const resources: TerraformResourceReference[] = [];

  if (isRecord(input.configuration) && isRecord(input.configuration.root_module)) {
    collectTerraformConfigurationResources(
      input.configuration.root_module as Record<string, unknown>,
      resources,
    );
  }

  if (resources.length === 0 && isRecord(input.planned_values) && isRecord(input.planned_values.root_module)) {
    collectTerraformPlannedResources(
      input.planned_values.root_module as Record<string, unknown>,
      resources,
    );
  }

  if (resources.length === 0) {
    for (const change of asArray<Record<string, unknown>>(input.resource_changes)) {
      const address = asString(change.address);
      if (!address) continue;
      resources.push({
        address,
        type: asString(change.type),
        name: asString(change.name) || address,
        label: address,
        nodeType: inferNodeTypeFromName(
          `${asString(change.type)} ${asString(change.name)} ${address}`,
          "compute",
        ),
        dependsOn: [],
      });
    }
  }

  const uniqueResources = new Map<string, TerraformResourceReference>();
  for (const resource of resources) {
    uniqueResources.set(resource.address, resource);
  }

  return Array.from(uniqueResources.values());
}

function importTerraformJson(
  input: Record<string, unknown>,
  context: ImportContext,
): ScenarioImportResult {
  const resources = collectTerraformResources(input);
  if (resources.length === 0) {
    throw new Error("No Terraform resources were found in the provided JSON artifact.");
  }

  const nodeDrafts = resources.map((resource) => ({
    key: slugify(resource.address),
    label: resource.label,
    type: resource.nodeType,
    status: "healthy" as const,
  }));
  const nodeKeyByAddress = new Map(
    resources.map((resource) => [resource.address, slugify(resource.address)]),
  );
  const edges: TopologyEdge[] = [];

  for (const resource of resources) {
    for (const dependency of resource.dependsOn) {
      const targetKey = nodeKeyByAddress.get(dependency);
      if (!targetKey) continue;
      edges.push({
        from: slugify(resource.address),
        to: targetKey,
      });
    }
  }

  const nodeList = materializeNodes(nodeDrafts);
  const resourceChanges = asArray<Record<string, unknown>>(input.resource_changes);
  const destructiveChanges = resourceChanges.filter((change) =>
    asArray<string>(change.change && isRecord(change.change) ? change.change.actions : []).some(
      (action) => action === "delete" || action === "replace",
    ),
  ).length;
  const summary = `Imported ${resources.length} Terraform resources${resourceChanges.length > 0 ? ` with ${resourceChanges.length} tracked plan changes` : ""}.`;

  return {
    pipeline: "terraform-json",
    summary,
    scenario: buildImportedScenario(
      "terraform-json",
      context.fileName,
      `Terraform Import: ${fileTitleFromName(context.fileName)}`,
      `${resources.length} infrastructure resources converted from Terraform JSON into a dependency-aware scenario scaffold.`,
      nodeList,
      edges,
      {
        executiveSummary: `${summary} The imported scenario reflects infrastructure dependencies discovered from Terraform JSON rather than a manually curated application map.`,
        technicalSummary:
          "Resource addresses were mapped into topology nodes and explicit dependency references were turned into edges where possible. The generated incident timeline is scaffolding and should be adapted to the intended infra change or outage story.",
        rootCause:
          "This scenario was generated from Terraform JSON. Replace the placeholder events with the concrete rollout failure, drift, or regression you want to simulate.",
        actions: [
          "Review resource addresses and dependency edges for noise before sharing the scenario",
          "Tailor the timeline to the actual planned change or incident mechanism",
          destructiveChanges > 0
            ? "Pay special attention to destructive plan actions and rollback coverage"
            : "Add rollback and validation steps before treating the scenario as production-ready",
        ],
        impactScore: destructiveChanges > 0 ? 72 : 58,
      },
      summary,
      undefined,
      destructiveChanges > 0 ? "high" : undefined,
      context.now,
    ),
  };
}

function normalizeIncidentSeverity(value: unknown): Severity {
  const normalized = asString(value).toLowerCase();

  switch (normalized) {
    case "critical":
    case "sev0":
    case "sev1":
    case "p0":
      return "critical";
    case "high":
    case "major":
    case "sev2":
    case "p1":
      return "high";
    case "medium":
    case "warning":
    case "minor":
    case "sev3":
    case "p2":
      return "medium";
    case "low":
    case "info":
    case "sev4":
    case "p3":
      return "low";
    default:
      return "medium";
  }
}

function inferIncidentEventType(value: string) {
  const normalized = value.toLowerCase();

  if (/(recover|restor|resolve|rollback|mitigat)/.test(normalized)) {
    return "recovery" as const;
  }
  if (/(drift|config|change|deploy|release)/.test(normalized)) {
    return "drift" as const;
  }
  if (/(cascade|spread|propagat)/.test(normalized)) {
    return "cascade" as const;
  }
  if (/(inject|exploit|attack|breach)/.test(normalized)) {
    return "injection" as const;
  }
  if (/(fail|down|error|outage|timeout|saturat)/.test(normalized)) {
    return "failure" as const;
  }
  return "alert" as const;
}

function parseTimelineTimestamp(
  value: unknown,
  baselineMs: number | null,
) {
  const directNumber = asNumber(value);
  if (directNumber != null) {
    return Math.max(0, Math.round(directNumber));
  }

  const text = asString(value);
  if (!text) {
    return null;
  }

  const parsedDate = Date.parse(text);
  if (!Number.isNaN(parsedDate) && baselineMs != null) {
    return Math.max(0, Math.round((parsedDate - baselineMs) / 1000));
  }

  return null;
}

function importIncidentArtifact(
  input: Record<string, unknown>,
  context: ImportContext,
): ScenarioImportResult {
  const incident = isRecord(input.incident) ? input.incident : null;
  const serviceRecords = asArray<Record<string, unknown>>(
    input.services ?? input.systems ?? input.components,
  );
  const rawTimeline = asArray<Record<string, unknown>>(
    input.timeline ?? input.events ?? input.alerts ?? incident?.timeline,
  );

  const nodeDrafts = new Map<string, NodeDraft>();
  const edges: TopologyEdge[] = [];

  for (const service of serviceRecords) {
    const name =
      asString(service.name) ||
      asString(service.id) ||
      asString(service.service) ||
      asString(service.component);
    if (!name) continue;

    const nodeKey = slugify(name);
    nodeDrafts.set(nodeKey, {
      key: nodeKey,
      label: name,
      type: inferNodeTypeFromName(
        `${name} ${asString(service.type)} ${asString(service.role)}`,
        "service",
      ),
      status: "healthy",
    });

    for (const dependency of asArray<string>(
      service.dependencies ?? service.dependsOn ?? service.upstreams,
    )) {
      edges.push({
        from: nodeKey,
        to: slugify(dependency),
      });
    }
  }

  for (const event of rawTimeline) {
    const affectedCandidates = [
      asString(event.service),
      asString(event.component),
      asString(event.system),
      ...asArray<string>(event.affected ?? event.services ?? event.components),
    ]
      .filter(Boolean)
      .map((value) => value.trim());

    for (const candidate of affectedCandidates) {
      const nodeKey = slugify(candidate);
      if (!nodeDrafts.has(nodeKey)) {
        nodeDrafts.set(nodeKey, {
          key: nodeKey,
          label: candidate,
          type: inferNodeTypeFromName(candidate, "service"),
          status: "healthy",
        });
      }
    }
  }

  if (nodeDrafts.size === 0) {
    const fallbackName =
      asString(incident?.title) || asString(input.title) || fileTitleFromName(context.fileName);
    nodeDrafts.set(slugify(fallbackName), {
      key: slugify(fallbackName),
      label: fallbackName,
      type: "service",
      status: "healthy",
    });
  }

  const baselineMs = rawTimeline
    .map((event) =>
      Date.parse(
        asString(event.timestamp) ||
          asString(event.time) ||
          asString(event.createdAt),
      ),
    )
    .filter((value) => !Number.isNaN(value))
    .sort((left, right) => left - right)[0] ?? null;

  const events = rawTimeline
    .map((event, index) => {
      const title =
        asString(event.title) ||
        asString(event.summary) ||
        asString(event.message) ||
        asString(event.name) ||
        `Event ${index + 1}`;
      const description =
        asString(event.description) ||
        asString(event.details) ||
        asString(event.message) ||
        title;
      const timestamp =
        parseTimelineTimestamp(
          event.timestamp ?? event.time ?? event.createdAt ?? event.offsetSeconds,
          baselineMs,
        ) ??
        index * 25;
      const affectedNodes = [
        asString(event.service),
        asString(event.component),
        asString(event.system),
        ...asArray<string>(event.affected ?? event.services ?? event.components),
      ]
        .filter(Boolean)
        .map((value) => slugify(value));

      return {
        id: `evt-incident-${index + 1}`,
        timestamp,
        type: inferIncidentEventType(`${title} ${description}`),
        severity: normalizeIncidentSeverity(event.severity ?? event.priority ?? event.level),
        title,
        description,
        affectedNodes,
      } satisfies TimelineEvent;
    })
    .sort((left, right) => left.timestamp - right.timestamp);

  const nodeList = materializeNodes(Array.from(nodeDrafts.values()));
  const title =
    asString(incident?.title) ||
    asString(input.title) ||
    `Incident Import: ${fileTitleFromName(context.fileName)}`;
  const summary = `Imported ${events.length} timeline event${events.length === 1 ? "" : "s"} across ${nodeList.length} service node${nodeList.length === 1 ? "" : "s"}.`;

  return {
    pipeline: "incident-artifact",
    summary,
    scenario: buildImportedScenario(
      "incident-artifact",
      context.fileName,
      title,
      asString(incident?.summary) ||
        asString(input.summary) ||
        "Generated from an incident artifact import.",
      nodeList,
      edges,
      {
        executiveSummary:
          asString(incident?.summary) ||
          asString(input.executiveSummary) ||
          summary,
        technicalSummary:
          asString(input.technicalSummary) ||
          asString(incident?.technicalSummary) ||
          "Timeline events, services, and dependencies were imported from an external incident artifact.",
        rootCause:
          asString(input.rootCause) ||
          asString(incident?.rootCause) ||
          "Root cause was not provided in the source artifact. Add it before sharing the scenario.",
        actions:
          asArray<string>(input.actions ?? incident?.actions).filter(Boolean).length > 0
            ? asArray<string>(input.actions ?? incident?.actions).filter(Boolean)
            : [
                "Validate the imported service graph against the real incident scope",
                "Review imported timestamps and severity normalization",
                "Add explicit recovery and follow-up actions if they were missing from the source artifact",
              ],
        impactScore:
          asNumber(input.impactScore) ??
          asNumber(incident?.impactScore) ??
          (events.some((event) => event.severity === "critical") ? 82 : 58),
      },
      summary,
      events,
      undefined,
      context.now,
    ),
  };
}

async function parseYamlDocuments(text: string) {
  const { loadAll } = await import("js-yaml");
  const documents: unknown[] = [];

  loadAll(text, (document) => {
    documents.push(document);
  });

  return documents.filter((value) => value != null);
}

function importScenarioJson(
  input: unknown,
  context: ImportContext,
): ScenarioImportResult {
  const scenario = parseScenario(input);
  return {
    pipeline: "scenario-json",
    summary: `Imported reusable scenario JSON "${scenario.name}".`,
    scenario: {
      ...scenario,
      id: createImportedScenarioId("scenario-json", context.fileName, context.now),
    },
  };
}

function importFromStructuredValue(
  value: unknown,
  context: ImportContext,
): ScenarioImportResult {
  if (Array.isArray(value) && value.every((item) => isKubernetesManifest(item))) {
    return importKubernetesManifests(value, context);
  }

  if (isKubernetesManifest(value)) {
    return importKubernetesManifests([value], context);
  }

  try {
    return importScenarioJson(value, context);
  } catch {
    // Continue with artifact-specific fallbacks.
  }

  if (isTerraformCandidate(value)) {
    return importTerraformJson(value, context);
  }

  if (isIncidentArtifactCandidate(value)) {
    return importIncidentArtifact(value, context);
  }

  throw new Error(
    "The file could not be recognized as scenario JSON, Kubernetes manifests, Terraform JSON, or an incident artifact.",
  );
}

export async function importScenarioArtifactFromText(
  text: string,
  context: ImportContext,
): Promise<ScenarioImportResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Import file is empty.");
  }

  const lowerFileName = context.fileName.toLowerCase();
  const likelyYaml =
    /\.ya?ml$/i.test(lowerFileName) ||
    trimmed.startsWith("---") ||
    (trimmed.includes("apiVersion:") && trimmed.includes("kind:"));

  if (!likelyYaml) {
    try {
      return importFromStructuredValue(JSON.parse(trimmed), context);
    } catch (error) {
      const yamlDocuments = await parseYamlDocuments(trimmed);
      if (yamlDocuments.length === 0) {
        throw error;
      }
      return importFromStructuredValue(
        yamlDocuments.length === 1 ? yamlDocuments[0] : yamlDocuments,
        context,
      );
    }
  }

  const yamlDocuments = await parseYamlDocuments(trimmed);
  if (yamlDocuments.length === 0) {
    throw new Error("No importable YAML documents were found in the file.");
  }

  return importFromStructuredValue(
    yamlDocuments.length === 1 ? yamlDocuments[0] : yamlDocuments,
    context,
  );
}

export function getScenarioImportPipelineLabel(pipeline: ScenarioImportPipeline) {
  return getPipelineLabel(pipeline);
}
