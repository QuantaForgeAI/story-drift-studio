import {
  analyzePerformanceBudgets,
  defaultPerformanceBudgets,
  formatBudgetReport,
} from "../../scripts/performance-budgets.mjs";

describe("performance budgets", () => {
  const manifest = {
    "index.html": {
      file: "assets/index-entry.js",
      isEntry: true,
      imports: ["assets/react-core.js", "assets/vendor.js"],
      css: ["assets/index.css"],
    },
    "assets/react-core.js": {
      file: "assets/react-core.js",
    },
    "assets/vendor.js": {
      file: "assets/vendor.js",
    },
    "src/components/ScenarioBuilder.tsx": {
      file: "assets/scenario-builder.js",
      isDynamicEntry: true,
    },
  };

  const assetSizes = {
    "assets/index-entry.js": 120_000,
    "assets/react-core.js": 95_000,
    "assets/vendor.js": 140_000,
    "assets/index.css": 42_000,
    "assets/scenario-builder.js": 88_000,
  };

  it("passes when the bundle stays within the configured thresholds", () => {
    const report = analyzePerformanceBudgets({
      manifest,
      assetSizes,
      budgets: {
        ...defaultPerformanceBudgets,
        maxInitialJsBytes: 400_000,
        maxInitialCssBytes: 60_000,
        maxInitialAssetBytes: 430_000,
        maxLargestAsyncChunkJsBytes: 100_000,
        maxTotalJsBytes: 500_000,
      },
    });

    expect(report.metrics.initialJsBytes).toBe(355_000);
    expect(report.metrics.initialCssBytes).toBe(42_000);
    expect(report.metrics.initialAssetBytes).toBe(397_000);
    expect(report.metrics.largestAsyncChunkJsBytes).toBe(88_000);
    expect(report.metrics.totalJsBytes).toBe(443_000);
    expect(report.failedChecks).toHaveLength(0);
  });

  it("reports explicit failures when a metric exceeds budget", () => {
    const report = analyzePerformanceBudgets({
      manifest,
      assetSizes,
      budgets: {
        ...defaultPerformanceBudgets,
        maxInitialJsBytes: 300_000,
        maxInitialCssBytes: 30_000,
        maxInitialAssetBytes: 350_000,
        maxLargestAsyncChunkJsBytes: 60_000,
        maxTotalJsBytes: 420_000,
      },
    });

    expect(report.failedChecks.map((check) => check.id)).toEqual([
      "initial-js",
      "initial-css",
      "initial-assets",
      "largest-async-js",
      "total-js",
    ]);
    expect(formatBudgetReport(report, assetSizes)).toContain(
      "FAIL Initial JavaScript",
    );
  });
});
