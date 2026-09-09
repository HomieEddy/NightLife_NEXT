import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Coverage config (plan 37).
 *
 * Scoped to live-core, excluding the demo track — mock sources
 * (mock-service.ts / *-mock-data.ts), src/app, src/components, src/i18n,
 * src/messages — the fixture layer by design (AGENTS.md §7). src/features and
 * src/lib live-core files are what the gate measures.
 *
 * Aggregate thresholds are set below today's measured live-core coverage so
 * the gate is real (it can fail) but green on day one; they ratchet upward as
 * the money/state-machine cores are lifted (see plan 37). Coverage options
 * live at the top-level `test` (shared across both projects) so vitest applies
 * the same scoping and thresholds to whichever project runs; the
 * `npm run test:coverage` script runs both.
 */
export default defineConfig({
  test: {
    env: { NEXT_PUBLIC_APP_MODE: "live" },
    coverage: {
      provider: "v8",
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/mock-service.ts",
        "**/mock-data.ts",
        "**/*-mock-service.ts",
        "**/*-mock-data.ts",
        "src/app/**",
        "src/components/**",
        "src/i18n/**",
        "src/messages/**",
        "**/types.ts",
        "**/schemas.ts",
        "**/*.live.tsx",
        "**/*.tsx",
      ],
      thresholds: {
        statements: 60,
        branches: 42,
        functions: 58,
        lines: 60,
      },
      reporter: ["text", "html", "json-summary"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.integration.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          environment: "node",
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
