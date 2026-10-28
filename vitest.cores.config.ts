import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Money/state-machine cores coverage gate (plan 37).
 *
 * A standalone config (run via `vitest --config vitest.cores.config.ts
 * --coverage`) because vitest's multi-project mode ignores per-project
 * `coverage` config — so the global `vitest.config.ts` scopes the whole
 * live-core graph but can't hold a mixed coverage+threshold for just the
 * money cores. This config runs the unit tests and scopes the v8 report to
 * the named money/state-machine cores, with an aggregate floor on that set.
 *
 * The `include` list restricts the report to exactly these files (everything
 * outside is dropped), so the floor is measured on the money/state cores in
 * isolation — a regression there can't hide behind the live-core aggregate.
 * Vitest 4 doesn't reliably enforce per-file thresholds here, so this is an
 * aggregate floor over the cores set.
 */
export default defineConfig({
  test: {
    env: { NEXT_PUBLIC_APP_MODE: "live" },
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: [
        "src/features/ordering/fees.ts",
        "src/features/ordering/pricing.ts",
        "src/features/ordering/costs.ts",
        "src/features/shared/order-status.ts",
        "src/lib/tab.ts",
        "src/lib/happy-hour.ts",
        "src/lib/order-line.ts",
        "src/lib/workforce.ts",
      ],
      exclude: ["**/*.test.ts", "**/types.ts", "**/schemas.ts"],
      thresholds: {
        statements: 90,
        functions: 90,
        lines: 90,
      },
      reporter: ["text", "json-summary"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});

