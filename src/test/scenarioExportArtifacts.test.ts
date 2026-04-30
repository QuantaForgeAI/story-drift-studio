import { describe, expect, it } from "vitest";
import { scenarios as builtInScenarios } from "@/data/scenarios";
import {
  createIncidentReportMarkdown,
  createPlaybackBriefMarkdown,
  createPostmortemMarkdown,
  formatScenarioExportFilename,
  type ScenarioRichExportContext,
} from "@/lib/scenarioExportArtifacts";

const scenario = builtInScenarios[0];

const exportContext: ScenarioRichExportContext = {
  scenario,
  origin: "custom",
  revision: 3,
  currentRevision: 4,
  publishedRevision: 2,
  shareUrl: "https://example.test/scenarios/supply-chain-attack?revision=3",
  exportedAt: "2026-04-24T03:15:00.000Z",
  auditLog: [
    {
      id: "audit-1",
      type: "scenario.updated",
      scenarioId: scenario.id,
      createdAt: "2026-04-24T02:50:00.000Z",
      message: "Updated the timeline after replay review.",
      actorUserId: "user-1",
      actorName: "Morgan",
      actorEmail: "morgan@example.test",
      actorRole: "editor",
      scenarioName: scenario.name,
      revision: 3,
      source: "edit",
      trigger: "manual",
      currentTime: null,
      activeEventCount: null,
      changeCount: 4,
    },
    {
      id: "audit-2",
      type: "scenario.exported",
      scenarioId: scenario.id,
      createdAt: "2026-04-24T03:05:00.000Z",
      message: "Exported for stakeholder review.",
      actorUserId: "user-1",
      actorName: "Morgan",
      actorEmail: "morgan@example.test",
      actorRole: "editor",
      scenarioName: scenario.name,
      revision: 3,
      source: "edit",
      trigger: "export",
      currentTime: 95,
      activeEventCount: 2,
      changeCount: null,
    },
  ],
  replaySnapshots: [
    {
      id: "snapshot-1",
      organizationId: "org-1",
      scenarioId: scenario.id,
      scenarioVersionId: "version-3",
      trigger: "export",
      currentTime: 95,
      activeEventIds: ["e5", "e6"],
      nodeStates: {
        api: "down",
        db: "down",
      },
      createdAt: "2026-04-24T03:05:00.000Z",
    },
    {
      id: "snapshot-2",
      organizationId: "org-1",
      scenarioId: scenario.id,
      scenarioVersionId: "version-3",
      trigger: "share",
      currentTime: 120,
      activeEventIds: ["e7"],
      nodeStates: {
        api: "degraded",
        db: "down",
      },
      createdAt: "2026-04-24T03:10:00.000Z",
    },
  ],
  replayState: {
    currentTime: 120,
    activeEventIds: ["e7"],
    nodeStates: {
      api: "degraded",
      db: "down",
    },
  },
};

describe("scenario export artifacts", () => {
  it("builds incident report markdown with timeline and replay context", () => {
    const markdown = createIncidentReportMarkdown(exportContext);

    expect(markdown).toContain(`# ${scenario.name} Incident Report`);
    expect(markdown).toContain("## Incident Timeline");
    expect(markdown).toContain("Data exfiltration in progress");
    expect(markdown).toContain("## Current Replay State");
    expect(markdown).toContain("Core API (degraded)");
    expect(markdown).toContain(exportContext.shareUrl as string);
  });

  it("builds postmortem markdown with root cause, audit, and snapshot sections", () => {
    const markdown = createPostmortemMarkdown(exportContext);

    expect(markdown).toContain(`# ${scenario.name} Postmortem`);
    expect(markdown).toContain(scenario.narrative.rootCause);
    expect(markdown).toContain("## Audit Trail");
    expect(markdown).toContain("Exported for stakeholder review.");
    expect(markdown).toContain("## Replay Snapshot Summary");
    expect(markdown).toContain("Snapshots captured: 2");
  });

  it("builds playback brief markdown with the share link and key moments", () => {
    const markdown = createPlaybackBriefMarkdown(exportContext);

    expect(markdown).toContain(`# ${scenario.name} Playback Brief`);
    expect(markdown).toContain("[Open the scenario playback]");
    expect(markdown).toContain(exportContext.shareUrl as string);
    expect(markdown).toContain("## Key Moments");
    expect(markdown).toContain("CI/CD pipeline config drift detected");
  });

  it("formats revision-aware export filenames", () => {
    const fileName = formatScenarioExportFilename(
      scenario,
      "incident-report",
      "md",
      3,
      "2026-04-24T03:15:00.000Z",
    );

    expect(fileName).toBe(
      "supply-chain-compromise-incident-report-r3-2026-04-24.md",
    );
  });
});
