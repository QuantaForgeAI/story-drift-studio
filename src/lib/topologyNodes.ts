import {
  Activity,
  BrainCircuit,
  Braces,
  Cloud,
  Cog,
  Cpu,
  Database,
  GitBranch,
  Globe,
  HardDrive,
  KeyRound,
  Monitor,
  Network,
  Route,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Waypoints,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const topologyNodeTypeValues = [
  "client",
  "mobile",
  "dns",
  "gateway",
  "load-balancer",
  "service",
  "compute",
  "serverless",
  "worker",
  "ai",
  "database",
  "storage",
  "cache",
  "queue",
  "stream",
  "identity",
  "observability",
  "security",
  "ci-cd",
  "external",
] as const;

export type TopologyNodeType = (typeof topologyNodeTypeValues)[number];

interface TopologyNodeGroup {
  label: string;
  types: TopologyNodeType[];
}

export interface TopologyNodeDefinition {
  type: TopologyNodeType;
  label: string;
  defaultLabel: string;
  description: string;
  group: TopologyNodeGroup["label"];
  icon: LucideIcon;
  className: string;
}

export const defaultTopologyNodeType: TopologyNodeType = "service";

export const topologyNodeTypeGroups: TopologyNodeGroup[] = [
  {
    label: "Clients & Edge",
    types: ["client", "mobile", "dns", "gateway", "load-balancer"],
  },
  {
    label: "Compute & Apps",
    types: ["service", "compute", "serverless", "worker", "ai"],
  },
  {
    label: "Data & Messaging",
    types: ["database", "storage", "cache", "queue", "stream"],
  },
  {
    label: "Control & Ops",
    types: ["identity", "observability", "security", "ci-cd"],
  },
  {
    label: "Integrations",
    types: ["external"],
  },
];

export const featuredTopologyNodeTypes: TopologyNodeType[] = [
  "client",
  "gateway",
  "service",
  "database",
  "cache",
  "queue",
  "observability",
  "security",
  "external",
];

export const topologyNodeDefinitions: TopologyNodeDefinition[] = [
  {
    type: "client",
    label: "Web Client",
    defaultLabel: "Web Client",
    description: "Browser apps, portals, and desktop frontends.",
    group: "Clients & Edge",
    icon: Monitor,
    className: "text-slate-200",
  },
  {
    type: "mobile",
    label: "Mobile App",
    defaultLabel: "Mobile App",
    description: "iOS, Android, and field-device experiences.",
    group: "Clients & Edge",
    icon: Smartphone,
    className: "text-violet-300",
  },
  {
    type: "dns",
    label: "DNS / Routing",
    defaultLabel: "DNS Layer",
    description: "Traffic routing, global DNS, and edge name resolution.",
    group: "Clients & Edge",
    icon: Globe,
    className: "text-sky-300",
  },
  {
    type: "gateway",
    label: "API Gateway",
    defaultLabel: "API Gateway",
    description: "Ingress controllers, reverse proxies, and API gateways.",
    group: "Clients & Edge",
    icon: Network,
    className: "text-indigo-300",
  },
  {
    type: "load-balancer",
    label: "Load Balancer",
    defaultLabel: "Load Balancer",
    description: "L4/L7 balancing, traffic split, and failover routing.",
    group: "Clients & Edge",
    icon: Route,
    className: "text-blue-300",
  },
  {
    type: "service",
    label: "Application Service",
    defaultLabel: "Application Service",
    description: "Core APIs, microservices, and backend application tiers.",
    group: "Compute & Apps",
    icon: ServerCog,
    className: "text-cyan-300",
  },
  {
    type: "compute",
    label: "Compute Node",
    defaultLabel: "Compute Node",
    description: "VMs, node pools, and general-purpose compute capacity.",
    group: "Compute & Apps",
    icon: Cpu,
    className: "text-orange-300",
  },
  {
    type: "serverless",
    label: "Serverless Function",
    defaultLabel: "Serverless Function",
    description: "Lambda-style functions, edge handlers, and ephemeral code.",
    group: "Compute & Apps",
    icon: Braces,
    className: "text-fuchsia-300",
  },
  {
    type: "worker",
    label: "Worker / Job Runner",
    defaultLabel: "Worker",
    description: "Background jobs, schedulers, and async execution pools.",
    group: "Compute & Apps",
    icon: Cog,
    className: "text-amber-300",
  },
  {
    type: "ai",
    label: "AI / ML System",
    defaultLabel: "AI Pipeline",
    description: "Inference services, vector workflows, and ML pipelines.",
    group: "Compute & Apps",
    icon: BrainCircuit,
    className: "text-pink-300",
  },
  {
    type: "database",
    label: "Database",
    defaultLabel: "Primary Database",
    description: "SQL, NoSQL, and transactional data stores.",
    group: "Data & Messaging",
    icon: Database,
    className: "text-emerald-300",
  },
  {
    type: "storage",
    label: "Storage",
    defaultLabel: "Object Storage",
    description: "Blob, object, block, or file-storage systems.",
    group: "Data & Messaging",
    icon: HardDrive,
    className: "text-teal-300",
  },
  {
    type: "cache",
    label: "Cache",
    defaultLabel: "Cache Layer",
    description: "Redis, Memcached, CDN cache, and in-memory acceleration.",
    group: "Data & Messaging",
    icon: Zap,
    className: "text-yellow-300",
  },
  {
    type: "queue",
    label: "Message Queue",
    defaultLabel: "Message Queue",
    description: "Queues, brokers, retry buffers, and async transport.",
    group: "Data & Messaging",
    icon: Waypoints,
    className: "text-amber-300",
  },
  {
    type: "stream",
    label: "Event Stream",
    defaultLabel: "Event Stream",
    description: "Kafka-style event buses and real-time data pipelines.",
    group: "Data & Messaging",
    icon: Workflow,
    className: "text-lime-300",
  },
  {
    type: "identity",
    label: "Identity / Access",
    defaultLabel: "Identity Provider",
    description: "IAM, SSO, auth, secrets access, and trust boundaries.",
    group: "Control & Ops",
    icon: KeyRound,
    className: "text-violet-300",
  },
  {
    type: "observability",
    label: "Observability",
    defaultLabel: "Observability Stack",
    description: "Metrics, tracing, logging, alerting, and dashboards.",
    group: "Control & Ops",
    icon: Activity,
    className: "text-rose-300",
  },
  {
    type: "security",
    label: "Security Control",
    defaultLabel: "Security Control",
    description: "WAF, firewall, SIEM, policy engines, and guardrails.",
    group: "Control & Ops",
    icon: ShieldCheck,
    className: "text-red-300",
  },
  {
    type: "ci-cd",
    label: "CI / CD Pipeline",
    defaultLabel: "CI/CD Pipeline",
    description: "Build, deploy, release, and software supply-chain systems.",
    group: "Control & Ops",
    icon: GitBranch,
    className: "text-green-300",
  },
  {
    type: "external",
    label: "External Dependency",
    defaultLabel: "External Service",
    description: "Third-party SaaS, partner APIs, CDN, and vendor systems.",
    group: "Integrations",
    icon: Cloud,
    className: "text-sky-300",
  },
];

export const topologyNodeDefinitionMap = topologyNodeDefinitions.reduce(
  (acc, definition) => {
    acc[definition.type] = definition;
    return acc;
  },
  {} as Record<TopologyNodeType, TopologyNodeDefinition>,
);

export function getTopologyNodeDefinition(type: TopologyNodeType) {
  return topologyNodeDefinitionMap[type];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getTopologyNodeLabel(type: TopologyNodeType, count = 1) {
  const { defaultLabel } = getTopologyNodeDefinition(type);
  return count > 1 ? `${defaultLabel} ${count}` : defaultLabel;
}

export function isDefaultTopologyNodeLabel(label: string, type: TopologyNodeType) {
  const { defaultLabel } = getTopologyNodeDefinition(type);
  const pattern = new RegExp(`^${escapeRegExp(defaultLabel)}(?:\\s+\\d+)?$`);
  return pattern.test(label.trim());
}

export function renameDefaultTopologyNodeLabel(
  label: string,
  fromType: TopologyNodeType,
  toType: TopologyNodeType,
) {
  if (!isDefaultTopologyNodeLabel(label, fromType)) {
    return label;
  }

  const fromDefaultLabel = getTopologyNodeDefinition(fromType).defaultLabel;
  const suffix = label.trim().slice(fromDefaultLabel.length).trim();
  const nextDefaultLabel = getTopologyNodeDefinition(toType).defaultLabel;

  return suffix ? `${nextDefaultLabel} ${suffix}` : nextDefaultLabel;
}
