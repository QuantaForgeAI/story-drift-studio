import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function getScopedPackageChunkName(
  normalizedId: string,
  scope: string,
  prefix: string,
) {
  const packageMatch = normalizedId.match(
    new RegExp(`/${scope.replace("/", "\\/")}/([^/]+)/`),
  );

  if (!packageMatch) {
    return undefined;
  }

  return `${prefix}-${packageMatch[1]
    .replace(/^react-/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()}`;
}

function getManualChunkName(id: string) {
  const normalizedId = id.split(path.sep).join("/");

  if (!normalizedId.includes("/node_modules/")) {
    return undefined;
  }

  if (
    normalizedId.includes("/react/") ||
    normalizedId.includes("/react-dom/") ||
    normalizedId.includes("/scheduler/")
  ) {
    return "vendor";
  }

  if (
    normalizedId.includes("/react-router/") ||
    normalizedId.includes("/react-router-dom/") ||
    normalizedId.includes("/@remix-run/")
  ) {
    return "router";
  }

  if (normalizedId.includes("/lucide-react/")) {
    return "icons";
  }

  const radixChunkName = getScopedPackageChunkName(
    normalizedId,
    "@radix-ui",
    "radix",
  );
  if (radixChunkName) {
    return radixChunkName;
  }

  if (normalizedId.includes("/react-hook-form/")) {
    return "forms";
  }

  if (normalizedId.includes("/@hookform/resolvers/")) {
    return "forms";
  }

  if (normalizedId.includes("/recharts/")) {
    return "charts";
  }

  if (normalizedId.includes("/js-yaml/") || normalizedId.includes("/yaml/")) {
    return "yaml-parser";
  }

  if (
    normalizedId.includes("/@tanstack/react-query/") ||
    normalizedId.includes("/@tanstack/query-core/")
  ) {
    return "query";
  }

  if (normalizedId.includes("/sonner/")) {
    return "sonner";
  }

  if (normalizedId.includes("/cmdk/")) {
    return "cmdk";
  }

  if (normalizedId.includes("/vaul/")) {
    return "vaul";
  }

  if (
    normalizedId.includes("/react-resizable-panels/") ||
    normalizedId.includes("/embla-carousel-react/")
  ) {
    return "ui-runtime";
  }

  if (normalizedId.includes("/date-fns/")) {
    return "date-utils";
  }

  return "vendor";
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return getManualChunkName(id);
        },
      },
    },
  },
}));
