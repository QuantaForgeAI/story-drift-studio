import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { WorkspaceProfileMenu } from "@/components/WorkspaceProfileMenu";
import { getPermissionsForRole } from "@/lib/scenarioAuth";

const organizations = [
  {
    organization: {
      id: "org-quanta",
      name: "QuantaForge",
    },
    membership: {
      id: "membership-owner",
      organizationId: "org-quanta",
      userId: "user-raymond",
      role: "owner" as const,
      createdAt: "2026-04-24T11:45:00.000Z",
      updatedAt: "2026-04-24T11:45:00.000Z",
    },
    storageKey: "tenant:org-quanta",
  },
  {
    organization: {
      id: "org-cascade",
      name: "Cascade Labs",
    },
    membership: {
      id: "membership-viewer",
      organizationId: "org-cascade",
      userId: "user-raymond",
      role: "viewer" as const,
      createdAt: "2026-04-24T11:45:00.000Z",
      updatedAt: "2026-04-24T11:45:00.000Z",
    },
    storageKey: "tenant:org-cascade",
  },
];

const securityVerifications = [
  {
    id: "verification-1",
    organizationId: "org-quanta",
    framework: "OWASP ASVS-aligned" as const,
    createdAt: "2026-04-24T13:10:00.000Z",
    actorUserId: "user-raymond",
    actorName: "Raymond Chan",
    actorRole: "owner" as const,
    authMethod: "oidc" as const,
    overallStatus: "pass" as const,
    passCount: 18,
    warnCount: 2,
    failCount: 0,
    findings: [],
  },
];

const systemLogs = [
  {
    id: "log-1",
    organizationId: "org-quanta",
    actorUserId: "user-raymond",
    actorName: "Raymond Chan",
    actorEmail: "raymond@quantaforge.ai",
    actorRole: "owner" as const,
    level: "warn" as const,
    category: "observability" as const,
    event: "telemetry.latency_spike",
    message: "Replay export exceeded the expected latency budget.",
    createdAt: "2026-04-24T13:12:00.000Z",
    requestId: "req-story-1",
    route: "/scenarios/iam-privilege-escalation",
    scenarioId: "iam-privilege-escalation",
    scenarioName: "IAM Privilege Escalation",
    details: {
      durationMs: 841,
    },
    errorName: null,
    errorStack: null,
  },
];

const telemetrySamples = [
  {
    id: "telemetry-1",
    organizationId: "org-quanta",
    actorUserId: "user-raymond",
    actorName: "Raymond Chan",
    actorRole: "owner" as const,
    source: "mock-backend" as const,
    scope: "scenario" as const,
    name: "scenario.save_latency",
    value: 182,
    unit: "ms" as const,
    status: "ok" as const,
    createdAt: "2026-04-24T13:13:00.000Z",
    requestId: "req-story-2",
    route: "/",
    scenarioId: "custom-k8s-checkout",
    scenarioName: "Checkout Edge Failover",
    details: {
      revision: 4,
    },
  },
];

const ownerViewer = {
  id: "user-raymond",
  name: "Raymond Chan",
  email: "raymond@quantaforge.ai",
  createdAt: "2026-04-24T11:30:00.000Z",
  updatedAt: "2026-04-24T13:00:00.000Z",
};

const editorViewer = {
  id: "user-olivia",
  name: "Olivia Park",
  email: "olivia@quantaforge.ai",
  createdAt: "2026-04-24T11:30:00.000Z",
  updatedAt: "2026-04-24T13:00:00.000Z",
};

const ownerMembership = organizations[0].membership;
const editorMembership = {
  ...ownerMembership,
  id: "membership-editor",
  userId: editorViewer.id,
  role: "editor" as const,
};

const meta = {
  title: "Simulator/Workspace Profile Menu",
  component: WorkspaceProfileMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  render: (args) => (
    <div className="mx-auto flex min-h-[320px] max-w-5xl items-start justify-end rounded-2xl border border-border/50 bg-surface-glass/70 p-6 backdrop-blur">
      <WorkspaceProfileMenu {...args} />
    </div>
  ),
} satisfies Meta<typeof WorkspaceProfileMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OwnerSession: Story = {
  args: {
    organizationId: "org-quanta",
    organizationName: "QuantaForge",
    viewer: ownerViewer,
    role: "owner",
    authSession: {
      id: "session-owner",
      organizationId: "org-quanta",
      userId: ownerViewer.id,
      method: "oidc",
      providerId: "oidc-okta",
      providerName: "Okta Workforce",
      issuer: "https://quantaforge.okta.com",
      subject: "00u-story-owner",
      audience: "storybook",
      email: ownerViewer.email,
      startedAt: "2026-04-24T12:00:00.000Z",
      lastAuthenticatedAt: "2026-04-24T13:00:00.000Z",
      expiresAt: "2026-04-24T20:00:00.000Z",
    },
    activeSsoProvider: {
      id: "oidc-okta",
      organizationId: "org-quanta",
      name: "Okta Workforce",
      status: "active",
      issuer: "https://quantaforge.okta.com",
      clientId: "storybook-client",
      discoveryUrl: "https://quantaforge.okta.com/.well-known/openid-configuration",
      authorizationEndpoint: "https://quantaforge.okta.com/oauth2/v1/authorize",
      tokenEndpoint: "https://quantaforge.okta.com/oauth2/v1/token",
      scopes: ["openid", "profile", "email", "groups"],
      redirectUri: "https://storybook.local/callback",
      domainHint: "quantaforge.ai",
      enforceSso: true,
      createdAt: "2026-04-24T11:40:00.000Z",
      updatedAt: "2026-04-24T11:40:00.000Z",
    },
    ssoConnections: [
      {
        organization: {
          id: "org-quanta",
          slug: "quantaforge",
          name: "QuantaForge",
          createdAt: "2026-04-24T11:35:00.000Z",
          updatedAt: "2026-04-24T11:35:00.000Z",
        },
        provider: {
          id: "oidc-okta",
          organizationId: "org-quanta",
          name: "Okta Workforce",
          status: "active",
          issuer: "https://quantaforge.okta.com",
          clientId: "storybook-client",
          discoveryUrl: "https://quantaforge.okta.com/.well-known/openid-configuration",
          authorizationEndpoint: "https://quantaforge.okta.com/oauth2/v1/authorize",
          tokenEndpoint: "https://quantaforge.okta.com/oauth2/v1/token",
          scopes: ["openid", "profile", "email", "groups"],
          redirectUri: "https://storybook.local/callback",
          domainHint: "quantaforge.ai",
          enforceSso: true,
          createdAt: "2026-04-24T11:40:00.000Z",
          updatedAt: "2026-04-24T11:40:00.000Z",
        },
        profiles: [
          {
            user: ownerViewer,
            membership: ownerMembership,
          },
          {
            user: editorViewer,
            membership: editorMembership,
          },
        ],
      },
    ],
    availableOrganizations: organizations,
    availableAccessProfiles: [
      {
        user: ownerViewer,
        membership: ownerMembership,
      },
      {
        user: editorViewer,
        membership: editorMembership,
      },
    ],
    permissions: getPermissionsForRole("owner"),
    securityVerifications,
    systemLogs,
    telemetrySamples,
    storageStrategy: {
      kind: "tenant-local-storage",
      controlPlaneKey: "storybook:control-plane",
      tenantStorageKey: "storybook:tenant:org-quanta",
      isolationBoundary: "organization",
    },
    motionMode: "system",
    onSignInWithOidc: fn(),
    onSignInAsUser: fn(),
    onSetMotionMode: fn(),
    onRunSecurityVerification: fn(),
    onSwitchOrganization: fn(),
  },
};

export const ViewerSession: Story = {
  args: {
    ...OwnerSession.args,
    viewer: {
      id: "user-mina",
      name: "Mina Patel",
      email: "mina@cascade.example",
      createdAt: "2026-04-24T11:30:00.000Z",
      updatedAt: "2026-04-24T13:00:00.000Z",
    },
    role: "viewer",
    authSession: {
      id: "session-viewer",
      organizationId: "org-cascade",
      userId: "user-mina",
      method: "preview",
      providerId: null,
      providerName: null,
      issuer: null,
      subject: null,
      audience: "storybook",
      email: "mina@cascade.example",
      startedAt: "2026-04-24T12:30:00.000Z",
      lastAuthenticatedAt: "2026-04-24T12:30:00.000Z",
      expiresAt: null,
    },
    organizationId: "org-cascade",
    organizationName: "Cascade Labs",
    permissions: getPermissionsForRole("viewer"),
    activeSsoProvider: null,
    motionMode: "reduced",
  },
};
