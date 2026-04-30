import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const defaultPerformanceBudgets = Object.freeze({
  maxInitialJsBytes: 560_000,
  maxInitialCssBytes: 90_000,
  maxInitialAssetBytes: 640_000,
  maxLargestAsyncChunkJsBytes: 220_000,
  maxTotalJsBytes: 780_000,
});

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function sumAssetBytes(files, assetSizes) {
  return files.reduce((total, file) => total + (assetSizes[file] ?? 0), 0);
}

function formatBytes(value) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} kB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walkFilesRecursively(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return walkFilesRecursively(fullPath);
    }

    return [fullPath];
  });
}

function collectAssetSizes(distDir) {
  const files = walkFilesRecursively(distDir);
  const assetSizes = {};

  for (const file of files) {
    const stats = fs.statSync(file);
    const relativePath = normalizePath(path.relative(distDir, file));

    assetSizes[relativePath] = stats.size;
  }

  return assetSizes;
}

function resolveInitialAssetsFromManifest(manifest, entryKey) {
  const jsFiles = new Set();
  const cssFiles = new Set();
  const visitedKeys = new Set();

  function visit(key) {
    if (!key || visitedKeys.has(key)) {
      return;
    }

    visitedKeys.add(key);
    const entry = manifest[key];

    if (!entry) {
      return;
    }

    if (typeof entry.file === "string" && entry.file.endsWith(".js")) {
      jsFiles.add(entry.file);
    }

    for (const cssFile of entry.css ?? []) {
      cssFiles.add(cssFile);
    }

    for (const importKey of entry.imports ?? []) {
      visit(importKey);
    }
  }

  visit(entryKey);

  return {
    jsFiles: Array.from(jsFiles),
    cssFiles: Array.from(cssFiles),
  };
}

function buildBudgetCheck(id, label, actual, limit) {
  return {
    id,
    label,
    actual,
    limit,
    passed: actual <= limit,
    delta: actual - limit,
  };
}

export function analyzePerformanceBudgets({
  manifest,
  assetSizes,
  budgets = defaultPerformanceBudgets,
}) {
  const entryKey =
    Object.keys(manifest).find((key) => key === "index.html") ??
    Object.keys(manifest).find((key) => manifest[key]?.isEntry) ??
    null;

  if (!entryKey) {
    throw new Error("Unable to find a primary Vite entry in the build manifest.");
  }

  const initialAssets = resolveInitialAssetsFromManifest(manifest, entryKey);
  const allJsFiles = Array.from(
    new Set(
      Object.values(manifest)
        .map((entry) => entry.file)
        .filter((file) => typeof file === "string" && file.endsWith(".js")),
    ),
  );

  const asyncJsFiles = allJsFiles.filter(
    (file) => !initialAssets.jsFiles.includes(file),
  );
  const initialJsBytes = sumAssetBytes(initialAssets.jsFiles, assetSizes);
  const initialCssBytes = sumAssetBytes(initialAssets.cssFiles, assetSizes);
  const totalJsBytes = sumAssetBytes(allJsFiles, assetSizes);
  const largestAsyncChunkJsBytes = asyncJsFiles.reduce(
    (largest, file) => Math.max(largest, assetSizes[file] ?? 0),
    0,
  );
  const initialAssetBytes = initialJsBytes + initialCssBytes;

  const checks = [
    buildBudgetCheck(
      "initial-js",
      "Initial JavaScript",
      initialJsBytes,
      budgets.maxInitialJsBytes,
    ),
    buildBudgetCheck(
      "initial-css",
      "Initial CSS",
      initialCssBytes,
      budgets.maxInitialCssBytes,
    ),
    buildBudgetCheck(
      "initial-assets",
      "Initial JS + CSS",
      initialAssetBytes,
      budgets.maxInitialAssetBytes,
    ),
    buildBudgetCheck(
      "largest-async-js",
      "Largest async JS chunk",
      largestAsyncChunkJsBytes,
      budgets.maxLargestAsyncChunkJsBytes,
    ),
    buildBudgetCheck(
      "total-js",
      "Total JS emitted",
      totalJsBytes,
      budgets.maxTotalJsBytes,
    ),
  ];

  return {
    entryKey,
    budgets,
    initialAssets,
    asyncJsFiles,
    metrics: {
      initialJsBytes,
      initialCssBytes,
      initialAssetBytes,
      largestAsyncChunkJsBytes,
      totalJsBytes,
    },
    checks,
    failedChecks: checks.filter((check) => !check.passed),
  };
}

export function formatBudgetReport(report, assetSizes) {
  const lines = [
    "Performance budget report",
    `Entry: ${report.entryKey}`,
    "",
    ...report.checks.map((check) => {
      const status = check.passed ? "PASS" : "FAIL";

      return `${status} ${check.label}: ${formatBytes(check.actual)} / ${formatBytes(check.limit)}`;
    }),
  ];

  if (report.initialAssets.jsFiles.length > 0) {
    lines.push("", "Initial JS assets:");
    for (const file of report.initialAssets.jsFiles) {
      lines.push(`- ${file} (${formatBytes(assetSizes[file] ?? 0)})`);
    }
  }

  if (report.initialAssets.cssFiles.length > 0) {
    lines.push("", "Initial CSS assets:");
    for (const file of report.initialAssets.cssFiles) {
      lines.push(`- ${file} (${formatBytes(assetSizes[file] ?? 0)})`);
    }
  }

  if (report.asyncJsFiles.length > 0) {
    const largestAsyncFiles = report.asyncJsFiles
      .slice()
      .sort((left, right) => (assetSizes[right] ?? 0) - (assetSizes[left] ?? 0))
      .slice(0, 5);

    lines.push("", "Largest async JS assets:");
    for (const file of largestAsyncFiles) {
      lines.push(`- ${file} (${formatBytes(assetSizes[file] ?? 0)})`);
    }
  }

  if (report.failedChecks.length > 0) {
    lines.push("", "Budget failures:");
    for (const check of report.failedChecks) {
      lines.push(
        `- ${check.label} exceeded the budget by ${formatBytes(check.delta)}`,
      );
    }
  }

  return lines.join("\n");
}

export function loadPerformanceBudgetInputs({
  rootDir = process.cwd(),
  budgetsFileName = "performance-budgets.json",
} = {}) {
  const distDir = path.join(rootDir, "dist");
  const manifestPath = path.join(distDir, ".vite", "manifest.json");
  const budgetsPath = path.join(rootDir, budgetsFileName);

  if (!fs.existsSync(distDir)) {
    throw new Error(`Build output not found at ${distDir}. Run "npm run build" first.`);
  }

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Vite manifest not found at ${manifestPath}. Ensure build.manifest is enabled.`,
    );
  }

  if (!fs.existsSync(budgetsPath)) {
    throw new Error(`Performance budget config not found at ${budgetsPath}.`);
  }

  return {
    manifest: readJsonFile(manifestPath),
    assetSizes: collectAssetSizes(distDir),
    budgets: {
      ...defaultPerformanceBudgets,
      ...readJsonFile(budgetsPath),
    },
  };
}

export function runPerformanceBudgetCheck(options = {}) {
  const { manifest, assetSizes, budgets } = loadPerformanceBudgetInputs(options);
  const report = analyzePerformanceBudgets({
    manifest,
    assetSizes,
    budgets,
  });
  const output = formatBudgetReport(report, assetSizes);

  console.log(output);

  if (report.failedChecks.length > 0) {
    throw new Error("Performance budget check failed.");
  }

  return report;
}

const scriptPath = fileURLToPath(import.meta.url);
const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === scriptPath;

if (isDirectExecution) {
  try {
    runPerformanceBudgetCheck();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
