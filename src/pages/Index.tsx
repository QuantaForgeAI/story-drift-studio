import React from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Activity, ListChecks, Monitor, Network, Plus, Download, Upload, Share2, ShieldCheck } from "lucide-react";
import { scenarios as builtInScenarios } from "@/data/scenarios";
import type { Scenario } from "@/data/scenarios";
import { TopologyMap } from "@/components/TopologyMap";
import { TimelinePanel } from "@/components/TimelinePanel";
import { NarrativePanel } from "@/components/NarrativePanel";
import { ScenarioSelector } from "@/components/ScenarioSelector";
import { WorkspaceProfileMenu } from "@/components/WorkspaceProfileMenu";
import { StatusBar } from "@/components/StatusBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { MotionPreferenceProvider } from "@/hooks/usePrefersReducedMotion";
import { useTimelineEngine } from "@/hooks/useTimelineEngine";
import { useScenarioWorkspace } from "@/hooks/useScenarioWorkspace";
import type { ScenarioRichExportKind } from "@/lib/scenarioExportArtifacts";
import { motionModeLabels, type MotionMode } from "@/lib/motionPreferences";
import { ScenarioConflictError } from "@/lib/scenarioBackendRepository";
import {
  recordSystemLog,
  recordTelemetrySample,
  reportSystemError,
} from "@/lib/scenarioObservability";
import {
  buildScenarioPath,
  buildScenarioSharePath,
  decodeScenarioSnapshot,
  parseScenarioPresentationState,
  SCENARIO_REVISION_SEARCH_PARAM,
  SCENARIO_SNAPSHOT_SEARCH_PARAM,
} from "@/lib/scenarioPermalinks";
import {
  buildScenarioPresentationBookmarks,
  getActivePresentationBookmark,
  getPresentationBookmarkById,
  type PresentationFocusPanel,
  type ScenarioPresentationBookmark,
} from "@/lib/scenarioPresentation";
import {
  getCurrentScenarioVersion,
  getPublishedScenarioVersion,
  getScenarioVersionByRevision,
} from "@/lib/scenarioWorkspace";
import { selectRecentObservabilityLogs } from "@/lib/observabilityLogView";

const LazyScenarioBuilder = React.lazy(async () => {
  const module = await import("@/components/ScenarioBuilder");

  return { default: module.ScenarioBuilder };
});

const LazyScenarioConflictDialog = React.lazy(async () => {
  const module = await import("@/components/ScenarioConflictDialog");

  return { default: module.ScenarioConflictDialog };
});

const LazyScenarioExportDialog = React.lazy(async () => {
  const module = await import("@/components/ScenarioExportDialog");

  return { default: module.ScenarioExportDialog };
});

const LazyScenarioShortcutDialog = React.lazy(async () => {
  const module = await import("@/components/ScenarioShortcutDialog");

  return { default: module.ScenarioShortcutDialog };
});

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseRevisionParam(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isShortcutInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

type WorkspaceMode = "timeline" | "observability" | "rootCause";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { scenarioId: routeScenarioId } = useParams();
  const [searchParams] = useSearchParams();
  const [showBuilder, setShowBuilder] = React.useState(false);
  const [showExportDialog, setShowExportDialog] = React.useState(false);
  const [exportBusyKind, setExportBusyKind] =
    React.useState<ScenarioRichExportKind | null>(null);
  const [saveConflict, setSaveConflict] = React.useState<ScenarioConflictError | null>(null);
  const [ephemeralScenarioOverride, setEphemeralScenarioOverride] = React.useState<Scenario | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const importedSnapshotRef = React.useRef<string | null>(null);
  const playbackSnapshotRef = React.useRef<string | null>(null);
  const sharedAccessToastRef = React.useRef<string | null>(null);
  const browserTelemetryCapturedRef = React.useRef(false);
  const lastAnnouncedScenarioKeyRef = React.useRef<string | null>(null);
  const lastAnnouncedEventIdRef = React.useRef<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = React.useState("");
  const reportPageEvent = React.useCallback(
    (input: Parameters<typeof recordSystemLog>[0]) => {
      recordSystemLog({
        ...input,
        route: input.route ?? location.pathname,
      });
    },
    [location.pathname],
  );
  const reportPageError = React.useCallback(
    (input: Parameters<typeof reportSystemError>[0]) => {
      reportSystemError({
        ...input,
        route: input.route ?? location.pathname,
      });
    },
    [location.pathname],
  );

  const selectedRevision = React.useMemo(
    () => parseRevisionParam(searchParams.get(SCENARIO_REVISION_SEARCH_PARAM)),
    [searchParams],
  );
  const snapshotParam = searchParams.get(SCENARIO_SNAPSHOT_SEARCH_PARAM);
  const presentationPreset = React.useMemo(
    () => parseScenarioPresentationState(searchParams),
    [searchParams],
  );
  const [presenterMode, setPresenterMode] = React.useState(
    presentationPreset.presenterMode,
  );
  const [presentationFocus, setPresentationFocus] =
    React.useState<PresentationFocusPanel>(presentationPreset.focusPanel);
  const [showSpeakerNotes, setShowSpeakerNotes] = React.useState(
    presentationPreset.presenterMode,
  );
  const [selectedBookmarkId, setSelectedBookmarkId] = React.useState<string | null>(
    presentationPreset.bookmarkId,
  );
  const [isShortcutDialogOpen, setIsShortcutDialogOpen] = React.useState(false);
  const [showScenarioDialog, setShowScenarioDialog] = React.useState(false);
  const [workspaceMode, setWorkspaceMode] = React.useState<WorkspaceMode>("timeline");
  const appliedPresentationPresetRef = React.useRef<string | null>(null);

  const sharedScenarioResult = React.useMemo(() => {
    if (!snapshotParam) {
      return {
        scenario: null as Scenario | null,
        error: null as string | null,
      };
    }

    try {
      return {
        scenario: decodeScenarioSnapshot(snapshotParam),
        error: null as string | null,
      };
    } catch (error) {
      return {
        scenario: null as Scenario | null,
        error: formatErrorMessage(error),
      };
    }
  }, [snapshotParam]);

  const {
    activeEntry,
    activeSsoProvider,
    activeScenario: latestScenario,
    activeScenarioId,
    authSession,
    availableOrganizations,
    availableAccessProfiles,
    auditLog,
    captureReplaySnapshot,
    customEntries,
    hasPermission,
    initialLoadError,
    lastSyncedAt,
    membership,
    metadataByScenarioId,
    motionMode,
    organization,
    permissions,
    saveScenario,
    signInAsUser,
    ssoConnections,
    refreshWorkspace,
    snapshotsByScenarioId,
    updateScenarioDraft,
    deleteScenario,
    markScenarioExported,
    publishScenarioRevision,
    scenarios,
    securityVerifications,
    storageStrategy,
    setActiveScenarioId,
    setMotionMode,
    runSecurityVerification,
    signInWithOidc,
    systemLogs,
    telemetrySamples,
    viewer,
    switchOrganization,
  } = useScenarioWorkspace({
    builtInScenarios,
    preferredActiveScenarioId: routeScenarioId ?? sharedScenarioResult.scenario?.id ?? null,
  });

  const canShareScenario = hasPermission("scenario.share");
  const canExportScenario = hasPermission("scenario.export");
  const canCreateScenario = hasPermission("scenario.create");
  const canImportScenario = hasPermission("scenario.import");
  const canEditScenario = hasPermission("scenario.edit");
  const canDeleteScenario = hasPermission("scenario.delete");
  const canPublishScenario = hasPermission("scenario.publish");
  const isReadOnlySharedView =
    !!snapshotParam &&
    !!sharedScenarioResult.scenario &&
    !canImportScenario;

  const selectedVersionRecord = React.useMemo(() => {
    if (!activeEntry || activeEntry.origin !== "custom" || selectedRevision == null) {
      return null;
    }

    return getScenarioVersionByRevision(activeEntry, selectedRevision);
  }, [activeEntry, selectedRevision]);

  const currentRevision = activeEntry ? getCurrentScenarioVersion(activeEntry).revision : null;
  const publishedRevision =
    activeEntry?.origin === "custom"
      ? getPublishedScenarioVersion(activeEntry)?.revision ?? null
      : null;
  const waitingForSharedScenario =
    !!snapshotParam &&
    !!sharedScenarioResult.scenario &&
    !isReadOnlySharedView &&
    !metadataByScenarioId.has(sharedScenarioResult.scenario.id);
  const isHistoricalRevision =
    activeEntry?.origin === "custom" &&
    selectedVersionRecord != null &&
    selectedVersionRecord.revision !== currentRevision;

  React.useEffect(() => {
    setEphemeralScenarioOverride(null);
  }, [activeScenarioId, selectedRevision]);

  React.useEffect(() => {
    playbackSnapshotRef.current = null;
  }, [activeScenarioId, selectedRevision]);

  React.useEffect(() => {
    if (browserTelemetryCapturedRef.current || typeof window === "undefined") {
      return;
    }

    browserTelemetryCapturedRef.current = true;

    recordTelemetrySample({
      source: "client",
      scope: "browser",
      name: "browser.viewport_width",
      value: window.innerWidth,
      unit: "count",
      details: {
        viewportHeight: window.innerHeight,
        userAgent: navigator.userAgent,
      },
      notify: false,
    });

    if (typeof navigator.hardwareConcurrency === "number") {
      recordTelemetrySample({
        source: "client",
        scope: "browser",
        name: "browser.hardware_concurrency",
        value: navigator.hardwareConcurrency,
        unit: "count",
        notify: false,
      });
    }

    const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
    if (typeof navigatorWithMemory.deviceMemory === "number") {
      recordTelemetrySample({
        source: "client",
        scope: "browser",
        name: "browser.device_memory_gb",
        value: navigatorWithMemory.deviceMemory,
        unit: "count",
        notify: false,
      });
    }

    const navigationEntry =
      performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;

    if (navigationEntry) {
      recordTelemetrySample({
        source: "client",
        scope: "navigation",
        name: "navigation.dom_complete",
        value: navigationEntry.domComplete,
        unit: "ms",
        details: {
          type: navigationEntry.type,
          loadEventEnd: Math.round(navigationEntry.loadEventEnd),
        },
      });
    }
  }, []);

  const scenario = React.useMemo(() => {
    const baseScenario =
      (isReadOnlySharedView ? sharedScenarioResult.scenario : null) ??
      selectedVersionRecord?.scenario ??
      latestScenario;
    if (!baseScenario) {
      return builtInScenarios[0] ?? null;
    }

    if (
      ephemeralScenarioOverride &&
      ephemeralScenarioOverride.id === baseScenario.id &&
      !isHistoricalRevision
    ) {
      return ephemeralScenarioOverride;
    }

    return baseScenario;
  }, [
    isReadOnlySharedView,
    sharedScenarioResult.scenario,
    selectedVersionRecord,
    latestScenario,
    ephemeralScenarioOverride,
    isHistoricalRevision,
  ]);

  const displayedRevision = selectedVersionRecord?.revision ?? currentRevision;

  React.useEffect(() => {
    if (!scenario) return;

    const scenarioKey = `${scenario.id}:${displayedRevision ?? "latest"}`;
    if (lastAnnouncedScenarioKeyRef.current === scenarioKey) {
      return;
    }

    lastAnnouncedScenarioKeyRef.current = scenarioKey;
    setLiveAnnouncement(
      displayedRevision
        ? `Loaded ${scenario.name}, revision ${displayedRevision}.`
        : `Loaded ${scenario.name}.`,
    );
  }, [displayedRevision, scenario]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const startedAt =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    const frame = window.requestAnimationFrame(() => {
      const duration =
        (typeof performance !== "undefined" && typeof performance.now === "function"
          ? performance.now()
          : Date.now()) - startedAt;

      recordTelemetrySample({
        source: "client",
        scope: "render",
        name: "render.route_commit",
        value: duration,
        unit: "ms",
        scenarioId: activeScenarioId ?? null,
        scenarioName: scenario?.name ?? null,
        details: {
          pathname: location.pathname,
          revision: displayedRevision ?? "latest",
        },
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [location.pathname, activeScenarioId, displayedRevision, scenario?.name]);

  React.useEffect(() => {
    if (!initialLoadError) return;

    reportPageEvent({
      level: "warn",
      category: "storage",
      event: "workspace.reset_after_load_failure",
      message: "Stored workspace was reset after a persistence failure.",
      details: {
        reason: initialLoadError,
      },
    });
    toast.error("Stored workspace was reset", {
      description: initialLoadError,
    });
  }, [initialLoadError, reportPageEvent]);

  React.useEffect(() => {
    if (!sharedScenarioResult.error) return;

    reportPageEvent({
      level: "warn",
      category: "share",
      event: "share.snapshot_invalid",
      message: "A shared scenario link contained an invalid or unreadable snapshot.",
      details: {
        error: sharedScenarioResult.error,
      },
    });
    toast.error("Shared scenario link is invalid", {
      description: sharedScenarioResult.error,
    });

    const nextSearch = new URLSearchParams(searchParams);
    nextSearch.delete(SCENARIO_SNAPSHOT_SEARCH_PARAM);
    navigate(
      {
        pathname: routeScenarioId ? buildScenarioPath(routeScenarioId) : "/",
        search: nextSearch.toString() ? `?${nextSearch.toString()}` : "",
      },
      { replace: true },
    );
  }, [sharedScenarioResult.error, searchParams, navigate, routeScenarioId, reportPageEvent]);

  React.useEffect(() => {
    if (!snapshotParam || !sharedScenarioResult.scenario) return;
    if (!canImportScenario) return;
    if (importedSnapshotRef.current === snapshotParam) return;

    try {
      saveScenario(sharedScenarioResult.scenario, "import");
      importedSnapshotRef.current = snapshotParam;

      toast.success("Shared scenario imported", {
        description: `${sharedScenarioResult.scenario.name} was added to this workspace.`,
      });
    } catch (error) {
      console.error(error);
      reportPageError({
        category: "share",
        event: "share.snapshot_import_failed",
        message: "Importing a shared scenario snapshot failed.",
        scenarioId: sharedScenarioResult.scenario.id,
        scenarioName: sharedScenarioResult.scenario.name,
        error,
      });
      toast.error("Could not import shared scenario", {
        description: formatErrorMessage(error),
      });
    }
  }, [snapshotParam, sharedScenarioResult.scenario, canImportScenario, reportPageError, saveScenario]);

  React.useEffect(() => {
    if (!isReadOnlySharedView || !sharedScenarioResult.scenario || !snapshotParam) return;
    if (sharedAccessToastRef.current === snapshotParam) return;

    toast("Read-only shared snapshot", {
      description: `${sharedScenarioResult.scenario.name} is viewable, but this role cannot import it into the workspace.`,
    });
    sharedAccessToastRef.current = snapshotParam;
  }, [isReadOnlySharedView, sharedScenarioResult.scenario, snapshotParam]);

  React.useEffect(() => {
    if (!snapshotParam || !sharedScenarioResult.scenario) return;
    if (isReadOnlySharedView) return;
    if (!metadataByScenarioId.has(sharedScenarioResult.scenario.id)) return;

    const nextSearch = new URLSearchParams(searchParams);
    nextSearch.delete(SCENARIO_SNAPSHOT_SEARCH_PARAM);
    navigate(
      {
        pathname: buildScenarioPath(sharedScenarioResult.scenario.id),
        search: nextSearch.toString() ? `?${nextSearch.toString()}` : "",
      },
      { replace: true },
    );
  }, [
    snapshotParam,
    sharedScenarioResult.scenario,
    metadataByScenarioId,
    searchParams,
    navigate,
    isReadOnlySharedView,
  ]);

  React.useEffect(() => {
    if (isReadOnlySharedView) return;
    if (waitingForSharedScenario) return;
    if (!activeScenarioId) return;

    const expectedPath = buildScenarioPath(activeScenarioId);
    if (location.pathname === expectedPath) return;

    navigate(
      {
        pathname: expectedPath,
        search: location.search,
      },
      { replace: true },
    );
  }, [
    activeScenarioId,
    location.pathname,
    location.search,
    navigate,
    isReadOnlySharedView,
    waitingForSharedScenario,
  ]);

  React.useEffect(() => {
    if (isReadOnlySharedView) return;
    if (!searchParams.get(SCENARIO_REVISION_SEARCH_PARAM)) return;
    if (activeEntry?.origin === "custom" && selectedVersionRecord) return;

    const nextSearch = new URLSearchParams(searchParams);
    nextSearch.delete(SCENARIO_REVISION_SEARCH_PARAM);
    navigate(
      {
        pathname: activeScenarioId ? buildScenarioPath(activeScenarioId) : location.pathname,
        search: nextSearch.toString() ? `?${nextSearch.toString()}` : "",
      },
      { replace: true },
    );
  }, [
    searchParams,
    activeEntry,
    selectedVersionRecord,
    navigate,
    activeScenarioId,
    location.pathname,
    isReadOnlySharedView,
  ]);

  const timeline = useTimelineEngine(scenario);
  const currentTime = timeline.currentTime;
  const isPlaying = timeline.isPlaying;
  const speed = timeline.speed;
  const activeEvents = timeline.activeEvents;
  const currentEvent = timeline.currentEvent;
  const nodeStates = timeline.nodeStates;
  const play = timeline.play;
  const pause = timeline.pause;
  const seek = timeline.seek;
  const setPlaybackSpeed = timeline.setSpeed;
  const resetTimeline = timeline.reset;
  const presentationBookmarks = React.useMemo(
    () => buildScenarioPresentationBookmarks(scenario),
    [scenario],
  );
  const requestedBookmark = React.useMemo(
    () =>
      getPresentationBookmarkById(
        presentationBookmarks,
        presentationPreset.bookmarkId,
      ),
    [presentationBookmarks, presentationPreset.bookmarkId],
  );
  const requestedPresentationTime =
    requestedBookmark?.time ?? presentationPreset.currentTime;

  React.useEffect(() => {
    setPresenterMode(presentationPreset.presenterMode);
    setPresentationFocus(presentationPreset.focusPanel);
    setShowSpeakerNotes(presentationPreset.presenterMode);
  }, [presentationPreset.focusPanel, presentationPreset.presenterMode]);

  React.useEffect(() => {
    if (presentationPreset.bookmarkId && requestedBookmark) {
      setSelectedBookmarkId(requestedBookmark.id);
      return;
    }

    const fallbackBookmark =
      getActivePresentationBookmark(presentationBookmarks, currentTime) ??
      presentationBookmarks[0] ??
      null;

    setSelectedBookmarkId(fallbackBookmark?.id ?? null);
  }, [
    presentationBookmarks,
    presentationPreset.bookmarkId,
    requestedBookmark,
    currentTime,
  ]);

  React.useEffect(() => {
    if (requestedPresentationTime == null) {
      return;
    }

    const presetKey = `${scenario.id}:${displayedRevision ?? "latest"}:${requestedPresentationTime}:${presentationPreset.bookmarkId ?? "none"}`;
    if (appliedPresentationPresetRef.current === presetKey) {
      return;
    }

    appliedPresentationPresetRef.current = presetKey;
    seek(requestedPresentationTime);
  }, [
    displayedRevision,
    presentationPreset.bookmarkId,
    requestedPresentationTime,
    scenario.id,
    seek,
  ]);

  const buildCurrentScenarioShareUrl = React.useCallback(() => {
    if (typeof window === "undefined" || !scenario) return null;

    const selectedBookmark = getPresentationBookmarkById(
      presentationBookmarks,
      selectedBookmarkId,
    );
    const sharePath = buildScenarioSharePath(scenario, {
      revision: activeEntry?.origin === "custom" ? displayedRevision : null,
      includeSnapshot: activeEntry?.origin === "custom",
      presentation:
        presenterMode ||
        currentTime > 0 ||
        presentationFocus !== "split"
          ? {
              presenterMode,
              currentTime,
              focusPanel: presentationFocus,
              bookmarkId:
                selectedBookmark && selectedBookmark.time > 0
                  ? selectedBookmark.id
                  : null,
            }
          : undefined,
    });

    return new URL(sharePath, window.location.origin).toString();
  }, [
    activeEntry?.origin,
    displayedRevision,
    presentationBookmarks,
    presentationFocus,
    presenterMode,
    scenario,
    selectedBookmarkId,
    currentTime,
  ]);

  React.useEffect(() => {
    if (currentTime === 0) {
      lastAnnouncedEventIdRef.current = null;
    }
  }, [currentTime]);

  React.useEffect(() => {
    const latestEvent = activeEvents.at(-1);
    if (!latestEvent) {
      return;
    }

    if (lastAnnouncedEventIdRef.current === latestEvent.id) {
      return;
    }

    lastAnnouncedEventIdRef.current = latestEvent.id;
    setLiveAnnouncement(
      `At ${latestEvent.timestamp} seconds, ${latestEvent.title || "an event"} occurred with ${latestEvent.severity} severity.`,
    );
  }, [activeEvents]);

  React.useEffect(() => {
    if (!scenario) return;
    if (currentTime <= 0 || currentTime < scenario.duration) return;

    const snapshotKey = `${scenario.id}:${displayedRevision ?? "latest"}:${currentTime}`;
    if (playbackSnapshotRef.current === snapshotKey) return;

    captureReplaySnapshot({
      scenarioId: scenario.id,
      revision: displayedRevision,
      trigger: "playback",
      currentTime,
      activeEventIds: activeEvents.map((event) => event.id),
      nodeStates,
    });
    playbackSnapshotRef.current = snapshotKey;
  }, [
    activeEvents,
    captureReplaySnapshot,
    currentTime,
    displayedRevision,
    nodeStates,
    scenario,
  ]);

  const affectedNodes = currentEvent?.affectedNodes ?? [];
  const progress = scenario.duration > 0 ? currentTime / scenario.duration : 0;
  const activeMetadata = metadataByScenarioId.get(scenario.id);

  const eventCounts = React.useMemo(
    () =>
      scenario.events.reduce(
        (counts, event) => {
          counts[event.severity] = (counts[event.severity] ?? 0) + 1;
          return counts;
        },
        {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
        } as Record<string, number>,
      ),
    [scenario.events],
  );

  const unstableNodes = React.useMemo(
    () => scenario.nodes.filter((node) => node.status !== "healthy").length,
    [scenario.nodes],
  );

  const upcomingEvent = React.useMemo(
    () => scenario.events.find((event) => event.timestamp > currentTime) ?? null,
    [scenario.events, currentTime],
  );

  const recentLogs = React.useMemo(
    () => selectRecentObservabilityLogs(systemLogs),
    [systemLogs],
  );

  const recentAudits = React.useMemo(
    () => auditLog.slice(0, 3),
    [auditLog],
  );

  const handleScenarioSelection = (scenarioId: string) => {
    setActiveScenarioId(scenarioId);
    navigate(buildScenarioPath(scenarioId));
  };

  const handleSignInAsUser = (userId: string) => {
    try {
      signInAsUser(userId);
      toast.success("Session switched", {
        description: `You are now operating as ${availableAccessProfiles.find((profile) => profile.user.id === userId)?.user.name ?? "the selected user"}.`,
      });
    } catch (error) {
      console.error(error);
      reportPageError({
        category: "auth",
        event: "auth.session_switch_failed",
        message: "Switching the active workspace identity failed.",
        error,
        details: {
          targetUserId: userId,
        },
      });
      toast.error("Could not switch session", {
        description: formatErrorMessage(error),
      });
    }
  };

  const handleSwitchOrganization = (organizationId: string) => {
    try {
      const nextWorkspaceState = switchOrganization(organizationId);
      if (nextWorkspaceState.activeScenarioId) {
        navigate(buildScenarioPath(nextWorkspaceState.activeScenarioId));
      }
      const nextWorkspace = availableOrganizations.find(
        (item) => item.organization.id === organizationId,
      );

      toast.success("Workspace switched", {
        description: `Now operating inside ${nextWorkspace?.organization.name ?? "the selected workspace"}.`,
      });
    } catch (error) {
      console.error(error);
      reportPageError({
        category: "storage",
        event: "tenant.workspace_switch_failed",
        message: "Switching the active organization workspace failed.",
        error,
        details: {
          targetOrganizationId: organizationId,
        },
      });
      toast.error("Could not switch workspace", {
        description: formatErrorMessage(error),
      });
    }
  };

  const handleSetMotionMode = (nextMotionMode: MotionMode) => {
    try {
      setMotionMode(nextMotionMode);
      setLiveAnnouncement(
        `Motion preference set to ${motionModeLabels[nextMotionMode]}.`,
      );
    } catch (error) {
      console.error(error);
      reportPageError({
        category: "application",
        event: "workspace.motion_preference_update_failed",
        message: "Updating the workspace motion preference failed.",
        error,
        details: {
          motionMode: nextMotionMode,
        },
      });
      toast.error("Could not update motion preference", {
        description: formatErrorMessage(error),
      });
    }
  };

  const handleRunSecurityVerification = async () => {
    try {
      const nextWorkspace = await runSecurityVerification();
      const latestRun = nextWorkspace.securityVerifications[0];

      setLiveAnnouncement(
        latestRun
          ? `Security verification completed with ${latestRun.overallStatus} status.`
          : "Security verification completed.",
      );
      toast.success("Security verification completed", {
        description: latestRun
          ? `${latestRun.passCount} pass, ${latestRun.warnCount} warn, ${latestRun.failCount} fail.`
          : "The workspace security report has been refreshed.",
      });
    } catch (error) {
      console.error(error);
      reportPageError({
        category: "application",
        event: "security.verification_run_failed",
        message: "Running the workspace security verification failed.",
        error,
      });
      toast.error("Could not run security verification", {
        description: formatErrorMessage(error),
      });
    }
  };

  const handleOidcSignIn = (providerId: string, userId: string) => {
    try {
      const nextWorkspace = signInWithOidc(providerId, userId);
      if (nextWorkspace.activeScenarioId) {
        navigate(buildScenarioPath(nextWorkspace.activeScenarioId));
      }

      toast.success("Enterprise SSO active", {
        description: `${nextWorkspace.viewer.name} is now authenticated through ${nextWorkspace.authSession.providerName ?? "the selected provider"}.`,
      });
    } catch (error) {
      console.error(error);
      reportPageError({
        category: "auth",
        event: "auth.oidc_sign_in_failed",
        message: "Establishing an enterprise OIDC session failed.",
        error,
        details: {
          providerId,
          targetUserId: userId,
        },
      });
      toast.error("Could not complete enterprise sign-in", {
        description: formatErrorMessage(error),
      });
    }
  };

  const handleRevisionSelection = (revision: number | null) => {
    if (!activeScenarioId) return;

    const nextSearch = new URLSearchParams(searchParams);
    if (revision == null) {
      nextSearch.delete(SCENARIO_REVISION_SEARCH_PARAM);
    } else {
      nextSearch.set(SCENARIO_REVISION_SEARCH_PARAM, String(revision));
    }

    navigate({
      pathname: buildScenarioPath(activeScenarioId),
      search: nextSearch.toString() ? `?${nextSearch.toString()}` : "",
    });
  };

  const handleScenarioConflict = (error: unknown) => {
    if (!(error instanceof ScenarioConflictError)) {
      return false;
    }

    setSaveConflict(error);
    reportPageEvent({
      level: "warn",
      category: "scenario",
      event: "scenario.save_conflict_detected",
      message: `Conflict detected while saving ${error.latestScenario.name}.`,
      scenarioId: error.scenarioId,
      scenarioName: error.latestScenario.name,
      details: {
        latestRevision: error.latestRevision,
        latestUpdatedAt: error.latestUpdatedAt,
        latestUpdatedBy: error.latestUpdatedByName,
      },
    });
    toast("Draft conflict detected", {
      description:
        error.latestUpdatedByName != null
          ? `${error.latestUpdatedByName} updated ${error.latestScenario.name}. Review the latest revision before saving again.`
          : `A newer revision of ${error.latestScenario.name} was detected.`,
    });
    return true;
  };

  const handleReviewLatestConflict = () => {
    refreshWorkspace();
    setSaveConflict(null);
    reportPageEvent({
      level: "info",
      category: "scenario",
      event: "scenario.conflict_review_latest",
      message: "Latest scenario revision loaded after a save conflict.",
    });
    toast.success("Latest revision loaded", {
      description: "The workspace was refreshed with the newest scenario state.",
    });
  };

  const handleSaveRecoveryRevision = () => {
    if (!saveConflict) return;

    try {
      saveScenario(saveConflict.attemptedScenario, "edit", {
        recordVersion: true,
        recordAudit: true,
        baseVersionId: saveConflict.latestVersionId,
        baseUpdatedAt: saveConflict.latestUpdatedAt,
      });
      navigate(buildScenarioPath(saveConflict.scenarioId));
      setSaveConflict(null);
      toast.success("Recovery revision saved", {
        description: `${saveConflict.attemptedScenario.name} was saved as a new revision on top of the latest workspace state.`,
      });
    } catch (error) {
      console.error(error);
      if (handleScenarioConflict(error)) {
        return;
      }
      reportPageError({
        category: "scenario",
        event: "scenario.recovery_revision_failed",
        message: "Saving a recovery revision failed.",
        scenarioId: saveConflict.scenarioId,
        scenarioName: saveConflict.attemptedScenario.name,
        error,
      });
      toast.error("Could not save recovery revision", {
        description: formatErrorMessage(error),
      });
    }
  };

  const handleNodePositionChange = (id: string, x: number, y: number) => {
    if (isHistoricalRevision) return;
    if (isReadOnlySharedView) return;

    if (activeEntry?.origin === "custom") {
      if (!canEditScenario) return;
      try {
        updateScenarioDraft(activeEntry.scenarioId, (currentScenario) => ({
          ...currentScenario,
          nodes: currentScenario.nodes.map((node) =>
            node.id === id ? { ...node, x, y } : node,
          ),
        }));
      } catch (error) {
        console.error(error);
        if (!handleScenarioConflict(error)) {
          reportPageError({
            category: "scenario",
            event: "scenario.draft_update_failed",
            message: "Updating a draft scenario failed.",
            scenarioId: activeEntry.scenarioId,
            scenarioName: scenario.name,
            error,
          });
          toast.error("Could not update scenario draft", {
            description: formatErrorMessage(error),
          });
        }
      }
      return;
    }

    setEphemeralScenarioOverride((previousOverride) => {
      const baseScenario =
        previousOverride && previousOverride.id === scenario.id
          ? previousOverride
          : scenario;

      return {
        ...baseScenario,
        nodes: baseScenario.nodes.map((node) =>
          node.id === id ? { ...node, x, y } : node,
        ),
      };
    });
  };

  const handleSaveScenario = (newScenario: Scenario) => {
    try {
      saveScenario(newScenario, "builder");
      navigate(buildScenarioPath(newScenario.id));
      setShowBuilder(false);
      toast.success("Scenario saved", {
        description: `${newScenario.name} is now available in your workspace.`,
      });
    } catch (error) {
      console.error(error);
      if (handleScenarioConflict(error)) {
        return;
      }
      reportPageError({
        category: "scenario",
        event: "scenario.save_failed",
        message: "Saving a scenario from the builder failed.",
        scenarioId: newScenario.id,
        scenarioName: newScenario.name,
        error,
      });
      toast.error("Could not save scenario", {
        description: formatErrorMessage(error),
      });
    }
  };

  const handleDeleteScenario = (scenarioId: string) => {
    const deletedScenario = scenarios.find((item) => item.id === scenarioId);
    try {
      deleteScenario(scenarioId);

      if (activeScenarioId === scenarioId) {
        navigate(buildScenarioPath(builtInScenarios[0].id));
      }

      toast.success("Custom scenario deleted", {
        description: deletedScenario?.name ?? "The scenario was removed from your workspace.",
      });
    } catch (error) {
      console.error(error);
      reportPageError({
        category: "scenario",
        event: "scenario.delete_failed",
        message: "Deleting a custom scenario failed.",
        scenarioId,
        scenarioName: deletedScenario?.name ?? null,
        error,
      });
      toast.error("Could not delete scenario", {
        description: formatErrorMessage(error),
      });
    }
  };

  const handleExportScenario = async () => {
    setExportBusyKind("scenario-json");
    try {
      captureReplaySnapshot({
        scenarioId: scenario.id,
        revision: displayedRevision,
        trigger: "export",
        currentTime: timeline.currentTime,
        activeEventIds: timeline.activeEvents.map((event) => event.id),
        nodeStates: timeline.nodeStates,
      });

      const { exportScenario } = await import("@/lib/scenarioIO");
      const { formatScenarioExportFilename } = await import(
        "@/lib/scenarioExportArtifacts"
      );

      exportScenario(
        scenario,
        formatScenarioExportFilename(
          scenario,
          "scenario-json",
          "json",
          displayedRevision,
        ),
      );
      markScenarioExported(scenario.id, scenario.name, displayedRevision);
      setShowExportDialog(false);
      toast.success("Scenario exported", {
        description: `${scenario.name} was downloaded as JSON.`,
      });
    } catch (error) {
      console.error(error);
      reportPageError({
        category: "export",
        event: "scenario.export_failed",
        message: "Exporting a scenario failed.",
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        details: {
          exportKind: "scenario-json",
        },
        error,
      });
      toast.error("Could not export scenario", {
        description: formatErrorMessage(error),
      });
    } finally {
      setExportBusyKind(null);
    }
  };

  const handleRichExport = async (kind: Exclude<ScenarioRichExportKind, "scenario-json">) => {
    setExportBusyKind(kind);

    try {
      captureReplaySnapshot({
        scenarioId: scenario.id,
        revision: displayedRevision,
        trigger: "export",
        currentTime: timeline.currentTime,
        activeEventIds: timeline.activeEvents.map((event) => event.id),
        nodeStates: timeline.nodeStates,
      });

      const shareUrl = canShareScenario ? buildCurrentScenarioShareUrl() : null;
      const replaySnapshots = snapshotsByScenarioId.get(scenario.id) ?? [];
      const replayState = {
        currentTime: timeline.currentTime,
        activeEventIds: timeline.activeEvents.map((event) => event.id),
        nodeStates: Object.fromEntries(timeline.nodeStates.entries()),
      };

      const {
        createIncidentReportMarkdown,
        createPlaybackBriefMarkdown,
        createPostmortemMarkdown,
        formatScenarioExportFilename,
      } = await import("@/lib/scenarioExportArtifacts");
      const { downloadTextExport } = await import("@/lib/scenarioIO");

      const exportContext = {
        scenario,
        origin: activeEntry?.origin ?? "builtin",
        revision: displayedRevision,
        currentRevision,
        publishedRevision,
        shareUrl,
        auditLog,
        replaySnapshots,
        replayState,
      };

      if (kind === "incident-report") {
        downloadTextExport(
          formatScenarioExportFilename(
            scenario,
            "incident-report",
            "md",
            displayedRevision,
          ),
          createIncidentReportMarkdown(exportContext),
        );
      } else if (kind === "postmortem") {
        downloadTextExport(
          formatScenarioExportFilename(
            scenario,
            "postmortem",
            "md",
            displayedRevision,
          ),
          createPostmortemMarkdown(exportContext),
        );
      } else {
        if (!shareUrl) {
          throw new Error("This access profile cannot generate stakeholder playback links.");
        }

        downloadTextExport(
          formatScenarioExportFilename(
            scenario,
            "playback-brief",
            "md",
            displayedRevision,
          ),
          createPlaybackBriefMarkdown(exportContext),
        );
      }

      markScenarioExported(scenario.id, scenario.name, displayedRevision);
      setShowExportDialog(false);
      toast.success("Export generated", {
        description: `${scenario.name} ${kind.replace(/-/g, " ")} was downloaded.`,
      });
    } catch (error) {
      console.error(error);
      reportPageError({
        category: "export",
        event: "scenario.rich_export_failed",
        message: "Generating a rich scenario export failed.",
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        details: {
          exportKind: kind,
        },
        error,
      });
      toast.error("Could not generate export", {
        description: formatErrorMessage(error),
      });
    } finally {
      setExportBusyKind(null);
    }
  };

  const handleCopyScenarioLink = async () => {
    try {
      captureReplaySnapshot({
        scenarioId: scenario.id,
        revision: displayedRevision,
        trigger: "share",
        currentTime: timeline.currentTime,
        activeEventIds: timeline.activeEvents.map((event) => event.id),
        nodeStates: timeline.nodeStates,
      });
      const shareUrl = buildCurrentScenarioShareUrl();
      if (!shareUrl) {
        throw new Error("Share links are unavailable in this environment.");
      }
      await window.navigator.clipboard.writeText(shareUrl);
      const includesPresentationPreset =
        presenterMode ||
        presentationFocus !== "split" ||
        timeline.currentTime > 0;

      toast.success("Share link copied", {
        description:
          activeEntry?.origin === "custom"
            ? includesPresentationPreset
              ? "The link includes the current scenario snapshot and demo preset."
              : "The link includes the current scenario snapshot."
            : includesPresentationPreset
              ? "The scenario permalink includes the current demo preset."
              : "The scenario permalink is ready to share.",
      });
    } catch (error) {
      console.error("Failed to copy scenario link", error);
      reportPageError({
        category: "share",
        event: "scenario.share_link_copy_failed",
        message: "Copying a share link failed.",
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        error,
      });
      toast.error("Could not copy scenario link", {
        description: formatErrorMessage(error),
      });
    }
  };

  const handlePublishRevision = (revision: number) => {
    try {
      publishScenarioRevision(scenario.id, revision);
      toast.success("Scenario revision published", {
        description: `${scenario.name} revision ${revision} is now marked live.`,
      });
    } catch (error) {
      console.error(error);
      reportPageError({
        category: "scenario",
        event: "scenario.publish_failed",
        message: "Publishing a scenario revision failed.",
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        details: {
          revision,
        },
        error,
      });
      toast.error("Could not publish scenario", {
        description: formatErrorMessage(error),
      });
    }
  };

  const handleImportScenario = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const { importScenario } = await import("@/lib/scenarioIO");
      const { scenario: importedScenario, summary } = await importScenario(file);

      saveScenario(importedScenario, "import");
      navigate(buildScenarioPath(importedScenario.id));
      toast.success("Scenario imported", {
        description: `${summary} ${importedScenario.name} was added to your workspace.`,
      });
    } catch (error) {
      console.error(error);
      if (handleScenarioConflict(error)) {
        return;
      }
      reportPageError({
        category: "import",
        event: "scenario.import_failed",
        message: "Importing a scenario artifact failed.",
        error,
      });
      toast.error("Import failed", {
        description: formatErrorMessage(error),
      });
    } finally {
      input.value = "";
    }
  };

  const handleTogglePresenterMode = React.useCallback(() => {
    setPresenterMode((previousMode) => {
      const nextPresenterMode = !previousMode;
      if (nextPresenterMode) {
        setShowSpeakerNotes(true);
      }
      setLiveAnnouncement(
        nextPresenterMode
          ? "Presenter mode enabled."
          : "Presenter mode disabled.",
      );
      return nextPresenterMode;
    });
  }, []);

  const handlePresentationFocusChange = React.useCallback((focusPanel: PresentationFocusPanel) => {
    setPresentationFocus(focusPanel);
    setLiveAnnouncement(`Presentation focus set to ${focusPanel}.`);
  }, []);

  const handleToggleSpeakerNotes = () => {
    const nextVisibility = !showSpeakerNotes;
    setShowSpeakerNotes(nextVisibility);
    setLiveAnnouncement(
      nextVisibility ? "Speaker notes shown." : "Speaker notes hidden.",
    );
  };

  const handleSelectPresentationBookmark = (
    bookmark: ScenarioPresentationBookmark,
  ) => {
    setSelectedBookmarkId(bookmark.id);
    if (presenterMode) {
      setPresentationFocus(bookmark.focus);
    }
    setShowSpeakerNotes(true);
    seek(bookmark.time);
    setLiveAnnouncement(
      `Jumped to bookmark ${bookmark.title} at ${bookmark.time} seconds.`,
    );
  };

  const handleJumpToNextEvent = React.useCallback(() => {
    const nextEvent = scenario.events.find(
      (event) => event.timestamp > currentTime,
    );

    if (!nextEvent) {
      return;
    }

    seek(nextEvent.timestamp);
    if (presenterMode) {
      const bookmark = getPresentationBookmarkById(
        presentationBookmarks,
        `bookmark-${nextEvent.id}`,
      );
      if (bookmark) {
        setPresentationFocus(bookmark.focus);
      }
    }
    setLiveAnnouncement(`Jumped to next event: ${nextEvent.title}.`);
  }, [
    presentationBookmarks,
    presenterMode,
    currentTime,
    scenario.events,
    seek,
  ]);

  const handleJumpToPreviousEvent = React.useCallback(() => {
    const previousEvents = scenario.events.filter(
      (event) => event.timestamp < currentTime,
    );
    const previousEvent = previousEvents.at(-1);

    if (!previousEvent) {
      seek(0);
      setLiveAnnouncement("Returned to the start of the scenario.");
      return;
    }

    seek(previousEvent.timestamp);
    if (presenterMode) {
      const bookmark = getPresentationBookmarkById(
        presentationBookmarks,
        `bookmark-${previousEvent.id}`,
      );
      if (bookmark) {
        setPresentationFocus(bookmark.focus);
      }
    }
    setLiveAnnouncement(`Jumped to previous event: ${previousEvent.title}.`);
  }, [
    presentationBookmarks,
    presenterMode,
    currentTime,
    scenario.events,
    seek,
  ]);

  React.useEffect(() => {
    const focusByKey: Record<string, PresentationFocusPanel> = {
      "1": "split",
      "2": "topology",
      "3": "timeline",
      "4": "narrative",
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isShortcutInputTarget(event.target)) return;

      const key = event.key;
      const normalizedKey = key.toLowerCase();

      if (key === "?" || (event.shiftKey && key === "/")) {
        event.preventDefault();
        setIsShortcutDialogOpen((open) => !open);
        return;
      }

      if (normalizedKey === "f") {
        event.preventDefault();
        handleTogglePresenterMode();
        return;
      }

      if (focusByKey[key]) {
        event.preventDefault();
        setPresenterMode(true);
        handlePresentationFocusChange(focusByKey[key]);
        return;
      }

      if (normalizedKey === "r") {
        event.preventDefault();
        resetTimeline();
        return;
      }

      if (key === " " || normalizedKey === "k") {
        event.preventDefault();
        if (isPlaying) {
          pause();
        } else {
          play();
        }
        return;
      }

      if (key === "ArrowRight" || normalizedKey === "n") {
        event.preventDefault();
        handleJumpToNextEvent();
        return;
      }

      if (key === "ArrowLeft" || normalizedKey === "p") {
        event.preventDefault();
        handleJumpToPreviousEvent();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handlePresentationFocusChange,
    handleJumpToNextEvent,
    handleJumpToPreviousEvent,
    handleTogglePresenterMode,
    isPlaying,
    pause,
    play,
    resetTimeline,
  ]);

  const selectedPresentationBookmark =
    getPresentationBookmarkById(presentationBookmarks, selectedBookmarkId) ??
    getActivePresentationBookmark(presentationBookmarks, currentTime);

  return (
    <MotionPreferenceProvider mode={motionMode}>
      <div className="min-h-screen flex flex-col bg-background">
      <a href="#simulator-main" className="skip-link">
        Skip to simulator workspace
      </a>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>
      <header className="border-b border-border/50 px-4 py-3 flex items-center justify-between bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative p-2 rounded-lg bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-cyan-500/20 border border-blue-400/30 shadow-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-transparent to-purple-400/10 animate-pulse" />
            <Network className="h-6 w-6 text-blue-600 relative z-10 drop-shadow-sm" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full" />
          </div>
          <div>
            <h1 className="font-heading text-sm tracking-wide text-foreground">SYSTEM DRIFT SIMULATOR</h1>
            <p className="text-[10px] text-muted-foreground font-mono tracking-wider">
              {organization.name.toUpperCase()} / INCIDENT MODELING & REPLAY ENGINE
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <nav
            className="flex items-center gap-1 rounded-full border border-border/60 bg-background/60 p-1 shadow-sm"
            aria-label="Scenario actions"
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleCopyScenarioLink}
              aria-label="Copy a share link for the current scenario"
              title="Copy scenario permalink"
              disabled={!canShareScenario}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setShowExportDialog(true)}
              aria-label="Open export options for the current scenario"
              title="Open export options"
              disabled={!canExportScenario}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Import a scenario from JSON, YAML, Kubernetes, Terraform, or incident artifacts"
              title="Import scenario artifact"
              disabled={!canImportScenario}
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.yaml,.yml"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={handleImportScenario}
            />
            <div className="mx-1 hidden h-4 w-px bg-border/70 sm:block" />
            <span className="hidden px-1 text-[10px] font-mono text-muted-foreground sm:inline">
              v1.0.0
            </span>
          </nav>
          <WorkspaceProfileMenu
            organizationId={organization.id}
            organizationName={organization.name}
            viewer={viewer}
            role={membership.role}
            authSession={authSession}
            activeSsoProvider={activeSsoProvider}
            ssoConnections={ssoConnections}
            availableOrganizations={availableOrganizations}
            availableAccessProfiles={availableAccessProfiles}
            permissions={permissions}
            securityVerifications={securityVerifications}
            systemLogs={systemLogs}
            telemetrySamples={telemetrySamples}
            storageStrategy={storageStrategy}
            motionMode={motionMode}
            onSignInWithOidc={handleOidcSignIn}
            onSignInAsUser={handleSignInAsUser}
            onSetMotionMode={handleSetMotionMode}
            onRunSecurityVerification={handleRunSecurityVerification}
            onSwitchOrganization={handleSwitchOrganization}
          />
        </div>
      </header>

      <div className="px-4 pt-3 space-y-3">
        <StatusBar
          currentTime={timeline.currentTime}
          duration={scenario.duration}
          eventsTriggered={timeline.activeEvents.length}
          totalEvents={scenario.events.length}
          severity={scenario.severity}
          scenarioName={scenario.name}
          presentationMode={presenterMode}
        />

        {!presenterMode ? (
          <div className="glass-panel grid gap-4 p-4 xl:grid-cols-[1.7fr_18rem]">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                    Active scenario
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {scenario.name}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-foreground/75">
                    {scenario.narrative.executiveSummary}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 gap-2"
                    onClick={() => setShowScenarioDialog(true)}
                  >
                    <ListChecks className="h-4 w-4" />
                    Scenario library
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 gap-2"
                    onClick={() => setShowBuilder(true)}
                    disabled={!canCreateScenario}
                  >
                    <Plus className="h-4 w-4" />
                    Build scenario
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                    Topology
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{scenario.nodes.length}</p>
                  <p className="mt-2 text-sm text-foreground/70">Nodes in the incident</p>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Events</p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{scenario.events.length}</p>
                  <p className="mt-2 text-sm text-foreground/70">Total replay steps</p>
                </div>
                <div className="rounded-3xl border border-border/60 bg-background/80 p-4">
                  <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                    Stability
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-foreground">{unstableNodes}</p>
                  <p className="mt-2 text-sm text-foreground/70">Nodes outside healthy state</p>
                </div>
              </div>
            </div>

            <aside className="rounded-3xl border border-border/60 bg-background/80 p-4">
              <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                Simulator mode
              </p>
              <div className="mt-4 grid gap-2">
                {([
                  {
                    mode: "timeline" as const,
                    label: "Timeline",
                    icon: Activity,
                    description: "Follow the replay and inspect active events.",
                  },
                  {
                    mode: "observability" as const,
                    label: "Observability",
                    icon: Monitor,
                    description: "Review logs, node health, and system trends.",
                  },
                  {
                    mode: "rootCause" as const,
                    label: "Root cause",
                    icon: ShieldCheck,
                    description: "Focus on failure analysis and remediation.",
                  },
                ]).map((item) => (
                  <button
                    key={item.mode}
                    type="button"
                    onClick={() => setWorkspaceMode(item.mode)}
                    className={`group flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                      workspaceMode === item.mode
                        ? "border-primary bg-primary/10 text-foreground shadow-sm"
                        : "border-border/60 bg-background hover:border-primary/40"
                    }`}
                  >
                    <item.icon className="h-4 w-4 text-primary" />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        ) : null}
      </div>

      <Dialog open={showScenarioDialog} onOpenChange={setShowScenarioDialog}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Choose a scenario</DialogTitle>
            <DialogDescription>
              Select the active incident and switch to a different replay workspace.
            </DialogDescription>
          </DialogHeader>
          <ScenarioSelector
            scenarios={scenarios}
            activeId={activeScenarioId}
            onSelect={(scenarioId) => {
              setShowScenarioDialog(false);
              handleScenarioSelection(scenarioId);
            }}
            onDelete={canDeleteScenario ? handleDeleteScenario : undefined}
            customScenarioIds={customEntries.map((entry) => entry.scenarioId)}
            metadataByScenarioId={metadataByScenarioId}
          />
        </DialogContent>
      </Dialog>

      <main
        id="simulator-main"
        tabIndex={-1}
        className="flex-1 flex flex-col gap-3 p-4 min-h-0"
      >
        {!presenterMode ? (
          <div className="grid flex-1 gap-3 xl:grid-cols-[1.7fr_1fr]">
            <section className="relative min-h-[38rem] overflow-hidden rounded-[2rem] border border-border/60 bg-background/40 shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-cyan-500/10 pointer-events-none" />
              <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background/90 to-transparent pointer-events-none" />
              <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background/95 via-transparent to-transparent pointer-events-none" />

              <div className="pb-20">
                <ErrorBoundary
                  title="Topology renderer failed"
                  description="The topology visualization crashed. Retry this panel or switch scenarios to continue."
                  resetKeys={[scenario.id, scenario.nodes.length, selectedRevision]}
                >
                  <TopologyMap
                    nodes={scenario.nodes}
                    edges={scenario.edges}
                    nodeStates={timeline.nodeStates}
                    affectedNodes={affectedNodes}
                    onNodePositionChange={
                      isHistoricalRevision || isReadOnlySharedView
                        ? undefined
                        : handleNodePositionChange
                    }
                  />
                </ErrorBoundary>
              </div>

              <div className="absolute left-6 right-6 bottom-6 rounded-3xl border border-border/60 bg-background/85 p-4 shadow-xl backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
                  Live replay briefing
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground/85">
                  {upcomingEvent
                    ? `Next event in ${Math.max(0, upcomingEvent.timestamp - currentTime)}s: ${upcomingEvent.title}`
                    : "Incident replay has reached the final state."}
                </p>
              </div>
            </section>

            <div className="flex flex-col gap-3">
              <TimelinePanel
                scenario={scenario}
                currentTime={timeline.currentTime}
                isPlaying={timeline.isPlaying}
                speed={timeline.speed}
                activeEvents={timeline.activeEvents}
                onPlay={timeline.play}
                onPause={timeline.pause}
                onSeek={timeline.seek}
                onSpeedChange={timeline.setSpeed}
                onReset={timeline.reset}
                onPreviousEvent={handleJumpToPreviousEvent}
                onNextEvent={handleJumpToNextEvent}
              />

              {workspaceMode === "timeline" && (
                <section className="glass-panel flex flex-col gap-4 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Timeline mode</p>
                      <h3 className="mt-2 text-lg font-semibold text-foreground">Incident pulse</h3>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.35em] text-primary">
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Triggered</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{activeEvents.length}</p>
                      <p className="mt-1 text-xs text-foreground/70">active events</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Remaining</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{scenario.events.length - activeEvents.length}</p>
                      <p className="mt-1 text-xs text-foreground/70">events ahead</p>
                    </div>
                  </div>
                </section>
              )}

              {workspaceMode === "observability" && (
                <section className="glass-panel flex flex-col gap-4 p-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Observability mode</p>
                    <h3 className="mt-2 text-lg font-semibold text-foreground">System health</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Healthy nodes</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{scenario.nodes.length - unstableNodes}</p>
                      <p className="mt-1 text-xs text-foreground/70">online</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Critical alerts</p>
                      <p className="mt-2 text-2xl font-semibold text-severity-critical">{eventCounts.critical}</p>
                      <p className="mt-1 text-xs text-foreground/70">highest severity</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Recent logs</p>
                    </div>
                    {recentLogs.length > 0 ? (
                      <ul className="space-y-2">
                        {recentLogs.map((log) => (
                          <li key={log.id} className="rounded-2xl border border-border/60 bg-background/80 p-3 text-sm text-foreground/80">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground">{log.level}</span>
                              <span className="text-[10px] text-muted-foreground">{log.category}</span>
                            </div>
                            <p className="mt-2 leading-relaxed">{log.message}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent observability signals are available.</p>
                    )}
                  </div>
                </section>
              )}

              {workspaceMode === "rootCause" && (
                <div className="flex flex-col gap-4">
                  <section className="glass-panel p-4">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">Root cause mode</p>
                    <h3 className="mt-2 text-lg font-semibold text-foreground">Failure analysis</h3>
                    <p className="mt-3 text-sm leading-6 text-foreground/75">{scenario.narrative.rootCause}</p>
                  </section>
                  <ErrorBoundary
                    title="Narrative panel failed"
                    description="The incident narrative could not be rendered. Retry the panel to continue reviewing the scenario."
                    resetKeys={[scenario.id, timeline.currentTime, selectedRevision]}
                  >
                    <NarrativePanel
                      narrative={scenario.narrative}
                      severity={scenario.severity}
                      progress={progress}
                      presentationMode
                    />
                  </ErrorBoundary>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-1 flex-col gap-3" aria-label="Presenter workspace">
            {presentationFocus === "split" ? (
              <div className="flex h-full min-h-0 flex-1 gap-3 xl:flex-row">
                <div className="min-h-0 min-w-0 flex-1 xl:flex-[1.45]">
                  <ErrorBoundary
                    title="Topology renderer failed"
                    description="The topology visualization crashed. Retry the panel or switch scenarios to continue."
                    resetKeys={[scenario.id, scenario.nodes.length, selectedRevision, presentationFocus]}
                  >
                    <TopologyMap
                      nodes={scenario.nodes}
                      edges={scenario.edges}
                      nodeStates={timeline.nodeStates}
                      affectedNodes={affectedNodes}
                      onNodePositionChange={
                        isHistoricalRevision || isReadOnlySharedView
                          ? undefined
                          : handleNodePositionChange
                      }
                    />
                  </ErrorBoundary>
                </div>
                <div className="flex min-h-0 w-full flex-col gap-3 xl:w-[34rem] xl:flex-shrink-0">
                  <div className="h-[360px] flex-shrink-0">
                    <ErrorBoundary
                      title="Timeline panel failed"
                      description="The playback controls encountered an error. Retry the panel to resume the simulation."
                      resetKeys={[scenario.id, timeline.currentTime, selectedRevision, presentationFocus]}
                    >
                      <TimelinePanel
                        scenario={scenario}
                        currentTime={timeline.currentTime}
                        isPlaying={timeline.isPlaying}
                        speed={timeline.speed}
                        activeEvents={timeline.activeEvents}
                        onPlay={timeline.play}
                        onPause={timeline.pause}
                        onSeek={timeline.seek}
                        onSpeedChange={timeline.setSpeed}
                        onReset={timeline.reset}
                        onPreviousEvent={handleJumpToPreviousEvent}
                        onNextEvent={handleJumpToNextEvent}
                        presentationMode
                      />
                    </ErrorBoundary>
                  </div>
                  <div className="min-h-0 flex-1">
                    <ErrorBoundary
                      title="Narrative panel failed"
                      description="The incident narrative could not be rendered. Retry the panel to continue reviewing the scenario."
                      resetKeys={[scenario.id, timeline.currentTime, selectedRevision, presentationFocus]}
                    >
                      <NarrativePanel
                        narrative={scenario.narrative}
                        severity={scenario.severity}
                        progress={progress}
                        presentationMode
                      />
                    </ErrorBoundary>
                  </div>
                </div>
              </div>
            ) : null}

            {presentationFocus === "topology" ? (
              <div className="min-h-0 flex-1">
                <ErrorBoundary
                  title="Topology renderer failed"
                  description="The topology visualization crashed. Retry the panel or switch scenarios to continue."
                  resetKeys={[scenario.id, scenario.nodes.length, selectedRevision, presentationFocus]}
                >
                  <TopologyMap
                    nodes={scenario.nodes}
                    edges={scenario.edges}
                    nodeStates={timeline.nodeStates}
                    affectedNodes={affectedNodes}
                    onNodePositionChange={
                      isHistoricalRevision || isReadOnlySharedView
                        ? undefined
                        : handleNodePositionChange
                    }
                  />
                </ErrorBoundary>
              </div>
            ) : null}

            {presentationFocus === "timeline" ? (
              <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-1">
                <div className="w-full min-h-0">
                  <ErrorBoundary
                    title="Timeline panel failed"
                    description="The playback controls encountered an error. Retry the panel to resume the simulation."
                    resetKeys={[scenario.id, timeline.currentTime, selectedRevision, presentationFocus]}
                  >
                    <TimelinePanel
                      scenario={scenario}
                      currentTime={timeline.currentTime}
                      isPlaying={timeline.isPlaying}
                      speed={timeline.speed}
                      activeEvents={timeline.activeEvents}
                      onPlay={timeline.play}
                      onPause={timeline.pause}
                      onSeek={timeline.seek}
                      onSpeedChange={timeline.setSpeed}
                      onReset={timeline.reset}
                      onPreviousEvent={handleJumpToPreviousEvent}
                      onNextEvent={handleJumpToNextEvent}
                      presentationMode
                    />
                  </ErrorBoundary>
                </div>
              </div>
            ) : null}

            {presentationFocus === "narrative" ? (
              <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-1">
                <div className="w-full min-h-0">
                  <ErrorBoundary
                    title="Narrative panel failed"
                    description="The incident narrative could not be rendered. Retry the panel to continue reviewing the scenario."
                    resetKeys={[scenario.id, timeline.currentTime, selectedRevision, presentationFocus]}
                  >
                    <NarrativePanel
                      narrative={scenario.narrative}
                      severity={scenario.severity}
                      progress={progress}
                      presentationMode
                    />
                  </ErrorBoundary>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>
      </div>
    </MotionPreferenceProvider>
  );
};

export default Index;
