import { describe, expect, it } from "vitest";
import { scenarios as builtInScenarios } from "@/data/scenarios";
import {
  buildScenarioPresentationBookmarks,
  formatPresentationTimestamp,
  getActivePresentationBookmark,
  parsePresentationFocusPanel,
} from "@/lib/scenarioPresentation";

describe("scenario presentation helpers", () => {
  it("builds a stable presenter bookmark sequence with overview and debrief", () => {
    const bookmarks = buildScenarioPresentationBookmarks(
      builtInScenarios[2],
    );

    expect(bookmarks[0]?.kind).toBe("overview");
    expect(bookmarks.at(-1)?.kind).toBe("debrief");
    expect(bookmarks.some((bookmark) => bookmark.kind === "failure")).toBe(true);
    expect(bookmarks.every((bookmark, index, all) => index === 0 || bookmark.time >= all[index - 1].time)).toBe(true);
  });

  it("returns the latest bookmark active at the current playback time", () => {
    const bookmarks = buildScenarioPresentationBookmarks(
      builtInScenarios[1],
    );

    const activeBookmark = getActivePresentationBookmark(bookmarks, 110);

    expect(activeBookmark).not.toBeNull();
    expect(activeBookmark?.time).toBeLessThanOrEqual(110);
  });

  it("parses and formats presentation metadata safely", () => {
    expect(parsePresentationFocusPanel("timeline")).toBe("timeline");
    expect(parsePresentationFocusPanel("unknown")).toBe("split");
    expect(formatPresentationTimestamp(125)).toBe("2:05");
  });
});
