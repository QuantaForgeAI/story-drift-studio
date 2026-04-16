import type { TopologyNodeType } from "@/lib/topologyNodes";
import { SCENARIO_SCHEMA_VERSION } from "@/lib/scenarioConstants";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export const severityValues = ["critical", "high", "medium", "low", "info"] as const;
export const topologyNodeStatusValues = ["healthy", "degraded", "down", "unknown"] as const;
export const timelineEventTypeValues = ["drift", "alert", "failure", "recovery", "injection", "cascade"] as const;

export interface TopologyNode {
  id: string;
  label: string;
  type: TopologyNodeType;
  x: number;
  y: number;
  status: (typeof topologyNodeStatusValues)[number];
}

export interface TopologyEdge {
  from: string;
  to: string;
  animated?: boolean;
}

export interface TimelineEvent {
  id: string;
  timestamp: number; // seconds into the incident
  type: (typeof timelineEventTypeValues)[number];
  severity: Severity;
  title: string;
  description: string;
  affectedNodes: string[];
  stateDiff?: { field: string; before: string; after: string }[];
}

export interface IncidentNarrative {
  executiveSummary: string;
  technicalSummary: string;
  rootCause: string;
  actions: string[];
  impactScore: number; // 0-100
}

export interface Scenario {
  schemaVersion: number;
  id: string;
  name: string;
  subtitle: string;
  severity: Severity;
  duration: number; // total seconds
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  events: TimelineEvent[];
  narrative: IncidentNarrative;
}

export const scenarios: Scenario[] = [
  {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id: "supply-chain-attack",
    name: "Supply Chain Compromise",
    subtitle: "Malicious dependency injection via CI/CD pipeline drift",
    severity: "critical",
    duration: 180,
    nodes: [
      { id: "gateway", label: "API Gateway", type: "gateway", x: 400, y: 60, status: "healthy" },
      { id: "auth", label: "Auth Service", type: "service", x: 200, y: 180, status: "healthy" },
      { id: "api", label: "Core API", type: "service", x: 400, y: 180, status: "healthy" },
      { id: "worker", label: "Worker Pool", type: "service", x: 600, y: 180, status: "healthy" },
      { id: "db", label: "PostgreSQL", type: "database", x: 300, y: 320, status: "healthy" },
      { id: "cache", label: "Redis Cache", type: "cache", x: 500, y: 320, status: "healthy" },
      { id: "queue", label: "Message Queue", type: "queue", x: 600, y: 320, status: "healthy" },
      { id: "cdn", label: "CDN / Static", type: "external", x: 100, y: 60, status: "healthy" },
    ],
    edges: [
      { from: "gateway", to: "auth" },
      { from: "gateway", to: "api" },
      { from: "api", to: "db" },
      { from: "api", to: "cache" },
      { from: "api", to: "worker" },
      { from: "worker", to: "queue" },
      { from: "worker", to: "db" },
      { from: "cdn", to: "gateway" },
      { from: "auth", to: "db" },
    ],
    events: [
      { id: "e1", timestamp: 0, type: "drift", severity: "info", title: "CI/CD pipeline config drift detected", description: "Build pipeline YAML modified — new npm registry mirror added to dependency resolution chain.", affectedNodes: ["api"], stateDiff: [{ field: "npm_registry", before: "registry.npmjs.org", after: "npm-mirror.internal.io" }] },
      { id: "e2", timestamp: 15, type: "drift", severity: "medium", title: "Dependency checksum mismatch", description: "Package `event-stream@4.0.1` integrity hash differs from baseline lockfile.", affectedNodes: ["api"], stateDiff: [{ field: "event-stream.sha512", before: "a3f8c1...baseline", after: "7d2e9b...modified" }] },
      { id: "e3", timestamp: 35, type: "injection", severity: "high", title: "Malicious payload deployed", description: "Modified dependency includes obfuscated exfiltration code targeting environment variables.", affectedNodes: ["api", "worker"] },
      { id: "e4", timestamp: 55, type: "alert", severity: "high", title: "Anomalous outbound connections", description: "Core API initiating HTTPS connections to unknown external IP 45.33.x.x on port 8443.", affectedNodes: ["api"] },
      { id: "e5", timestamp: 75, type: "cascade", severity: "critical", title: "Database credentials exfiltrated", description: "Environment variable DB_PASSWORD observed in outbound payload. Credential rotation required.", affectedNodes: ["api", "db"] },
      { id: "e6", timestamp: 95, type: "failure", severity: "critical", title: "Unauthorized database access", description: "Foreign IP authenticated to PostgreSQL using exfiltrated credentials. 2.3M rows queried from users table.", affectedNodes: ["db"] },
      { id: "e7", timestamp: 120, type: "alert", severity: "critical", title: "Data exfiltration in progress", description: "Bulk SELECT queries and chunked HTTPS uploads detected. Estimated 450MB transferred.", affectedNodes: ["db", "api"] },
      { id: "e8", timestamp: 145, type: "recovery", severity: "high", title: "Emergency credential rotation", description: "All database passwords rotated. Foreign IP blocked. API pods recycled with clean image.", affectedNodes: ["db", "api", "auth"] },
      { id: "e9", timestamp: 165, type: "recovery", severity: "medium", title: "Pipeline lockdown & audit", description: "CI/CD pipeline reverted to signed baseline. Full dependency tree audit initiated.", affectedNodes: ["api", "worker"] },
      { id: "e10", timestamp: 180, type: "recovery", severity: "low", title: "Incident contained", description: "All services restored to known-good baseline. Forensic timeline preserved.", affectedNodes: [] },
    ],
    narrative: {
      executiveSummary: "A sophisticated supply chain attack compromised our CI/CD pipeline, injecting a malicious dependency that exfiltrated database credentials. An estimated 2.3 million user records were accessed before containment. Total incident duration: 3 minutes (simulated).",
      technicalSummary: "Attacker modified the npm registry mirror in the CI/CD pipeline configuration, substituting event-stream@4.0.1 with a trojanized version containing obfuscated credential-harvesting code. The payload targeted process.env to extract DB_PASSWORD, forwarding it via HTTPS to C2 at 45.33.x.x:8443. Using stolen credentials, the attacker queried the users table, exfiltrating ~450MB before detection.",
      rootCause: "Unsigned CI/CD pipeline configuration allowed unauthorized modification of the npm registry mirror. Lack of dependency pinning with integrity verification enabled the substitution attack.",
      actions: [
        "Enforce cryptographic signing on all CI/CD pipeline configurations",
        "Implement Subresource Integrity (SRI) checks for all npm dependencies",
        "Deploy network egress filtering to block unauthorized outbound connections",
        "Rotate all credentials and API keys across all environments",
        "Notify affected users per breach disclosure requirements",
      ],
      impactScore: 92,
    },
  },
  {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id: "k8s-drift-cascade",
    name: "Kubernetes Config Cascade",
    subtitle: "Resource limit removal triggers OOM cascade across cluster",
    severity: "high",
    duration: 150,
    nodes: [
      { id: "ingress", label: "Ingress Controller", type: "gateway", x: 400, y: 60, status: "healthy" },
      { id: "frontend", label: "Frontend Pods", type: "service", x: 200, y: 180, status: "healthy" },
      { id: "backend", label: "Backend Pods", type: "service", x: 400, y: 180, status: "healthy" },
      { id: "ml", label: "ML Pipeline", type: "service", x: 600, y: 180, status: "healthy" },
      { id: "pg", label: "PostgreSQL", type: "database", x: 300, y: 320, status: "healthy" },
      { id: "redis", label: "Redis", type: "cache", x: 500, y: 320, status: "healthy" },
    ],
    edges: [
      { from: "ingress", to: "frontend" },
      { from: "ingress", to: "backend" },
      { from: "backend", to: "pg" },
      { from: "backend", to: "redis" },
      { from: "backend", to: "ml" },
      { from: "ml", to: "redis" },
    ],
    events: [
      { id: "k1", timestamp: 0, type: "drift", severity: "medium", title: "Resource limits removed from ML pods", description: "Kubernetes deployment spec drift: memory limits removed from ml-pipeline deployment.", affectedNodes: ["ml"], stateDiff: [{ field: "resources.limits.memory", before: "2Gi", after: "null" }] },
      { id: "k2", timestamp: 20, type: "alert", severity: "medium", title: "ML pod memory usage climbing", description: "ml-pipeline-7d8f consuming 4.2Gi memory, no limit enforced.", affectedNodes: ["ml"] },
      { id: "k3", timestamp: 45, type: "failure", severity: "high", title: "Node OOM — evictions triggered", description: "Worker node k8s-node-03 hit OOM threshold. Kubelet evicting low-priority pods.", affectedNodes: ["ml", "backend"] },
      { id: "k4", timestamp: 65, type: "cascade", severity: "high", title: "Backend pods rescheduled", description: "3/5 backend replicas evicted. Remaining pods overloaded — p99 latency 12s.", affectedNodes: ["backend", "pg"] },
      { id: "k5", timestamp: 85, type: "failure", severity: "critical", title: "Connection pool exhaustion", description: "PostgreSQL max_connections hit. New connections refused. 502 errors at ingress.", affectedNodes: ["pg", "ingress"] },
      { id: "k6", timestamp: 105, type: "alert", severity: "critical", title: "Full service degradation", description: "All user-facing endpoints returning 502/503. SLA breach detected.", affectedNodes: ["ingress", "frontend", "backend"] },
      { id: "k7", timestamp: 125, type: "recovery", severity: "high", title: "Resource limits restored", description: "ML deployment patched with original resource limits. Pods restarting.", affectedNodes: ["ml"] },
      { id: "k8", timestamp: 150, type: "recovery", severity: "low", title: "Cluster stabilized", description: "All pods healthy. Connection pools drained. Latency normalized.", affectedNodes: [] },
    ],
    narrative: {
      executiveSummary: "Removal of Kubernetes resource limits on the ML pipeline triggered a cascading failure across the cluster, causing a 45-minute service outage affecting all user-facing endpoints.",
      technicalSummary: "A configuration drift removed memory limits from the ml-pipeline deployment. Unbounded memory growth triggered node-level OOM, evicting co-located backend pods. Reduced backend capacity exhausted PostgreSQL connection pools, propagating 502 errors through the ingress controller.",
      rootCause: "Manual kubectl edit removed resource limits without PR review. No drift detection policy was enforcing resource constraint baselines.",
      actions: [
        "Implement OPA/Gatekeeper policies requiring resource limits on all deployments",
        "Enable continuous drift detection against GitOps-managed manifests",
        "Add node-level memory alerting at 70% threshold",
        "Implement PodDisruptionBudgets for critical services",
      ],
      impactScore: 78,
    },
  },
  {
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    id: "iam-privilege-escalation",
    name: "IAM Privilege Escalation",
    subtitle: "Stale IAM policy drift enables unauthorized admin access",
    severity: "critical",
    duration: 160,
    nodes: [
      { id: "console", label: "AWS Console", type: "external", x: 400, y: 50, status: "healthy" },
      { id: "iam", label: "IAM Service", type: "service", x: 250, y: 170, status: "healthy" },
      { id: "lambda", label: "Lambda Functions", type: "service", x: 550, y: 170, status: "healthy" },
      { id: "s3", label: "S3 Buckets", type: "database", x: 200, y: 310, status: "healthy" },
      { id: "rds", label: "RDS Instance", type: "database", x: 400, y: 310, status: "healthy" },
      { id: "secrets", label: "Secrets Manager", type: "service", x: 600, y: 310, status: "healthy" },
    ],
    edges: [
      { from: "console", to: "iam" },
      { from: "console", to: "lambda" },
      { from: "iam", to: "s3" },
      { from: "iam", to: "rds" },
      { from: "lambda", to: "secrets" },
      { from: "lambda", to: "rds" },
    ],
    events: [
      { id: "i1", timestamp: 0, type: "drift", severity: "medium", title: "IAM policy drift detected", description: "Role dev-team-role has new inline policy granting iam:* and sts:AssumeRole.", affectedNodes: ["iam"], stateDiff: [{ field: "policy.Action", before: '["s3:GetObject","s3:PutObject"]', after: '["iam:*","sts:AssumeRole","s3:*"]' }] },
      { id: "i2", timestamp: 25, type: "injection", severity: "high", title: "Role assumption chain initiated", description: "dev-team-role assumed admin-role via sts:AssumeRole. Privilege boundary bypassed.", affectedNodes: ["iam"] },
      { id: "i3", timestamp: 50, type: "alert", severity: "high", title: "Secrets Manager access spike", description: "120 GetSecretValue calls in 30 seconds from assumed admin-role session.", affectedNodes: ["secrets"] },
      { id: "i4", timestamp: 75, type: "cascade", severity: "critical", title: "Production secrets harvested", description: "Database passwords, API keys, and encryption keys accessed from Secrets Manager.", affectedNodes: ["secrets", "rds"] },
      { id: "i5", timestamp: 100, type: "failure", severity: "critical", title: "RDS data accessed via stolen creds", description: "Direct RDS connection from unknown IP using harvested credentials. Audit tables queried.", affectedNodes: ["rds"] },
      { id: "i6", timestamp: 125, type: "recovery", severity: "high", title: "IAM policy reverted & sessions revoked", description: "Inline policy removed. All active sessions for dev-team-role invalidated.", affectedNodes: ["iam"] },
      { id: "i7", timestamp: 145, type: "recovery", severity: "medium", title: "Full secret rotation initiated", description: "All Secrets Manager entries rotated. RDS passwords changed. Lambda env vars updated.", affectedNodes: ["secrets", "rds", "lambda"] },
      { id: "i8", timestamp: 160, type: "recovery", severity: "low", title: "Incident contained", description: "Access logs preserved. Forensic analysis underway.", affectedNodes: [] },
    ],
    narrative: {
      executiveSummary: "An unauthorized IAM policy modification granted escalated privileges, enabling a threat actor to harvest production secrets and access the primary database. All credentials have been rotated and the attack vector sealed.",
      technicalSummary: "An inline policy was attached to dev-team-role granting iam:* and sts:AssumeRole permissions. This was used to assume admin-role, bypassing permission boundaries. The escalated session accessed 47 secrets from Secrets Manager and established a direct connection to the production RDS instance.",
      rootCause: "No SCPs (Service Control Policies) restricting iam:* grants at the OU level. IAM policy drift went undetected for 72 hours due to scan interval gaps.",
      actions: [
        "Deploy SCPs blocking iam:* and sts:AssumeRole on non-admin OUs",
        "Reduce drift scan interval from 24h to 15min for IAM resources",
        "Implement permission boundaries on all developer roles",
        "Enable CloudTrail real-time alerting for privilege escalation patterns",
      ],
      impactScore: 95,
    },
  },
];
