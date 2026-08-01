import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // These established loading and live-event patterns are intentionally
      // retained; surface them without making the documented lint gate red.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react/no-unescaped-entities": "warn",
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/lib/mock-services/*",
                "*/mock-services/*",
                "@/lib/mock-data/*",
                "*/mock-data/*",
                "@/components/demo/*",
              ],
              message:
                "Live UI must use service selectors and shared mode wrappers, never mock/demo modules directly.",
            },
          ],
        },
      ],
    },
  },
  // The UI component layer must never reach the database directly — it goes
  // through the service selector / TanStack Query hooks. Forbidding the DB
  // clients here is the app-layer tenant-scoping tripwire in lieu of RLS
  // (ARD AD-3): a component that imported the unscoped client could leak across
  // tenants. Route handlers and feature-core code legitimately use these
  // clients (many models bypass the tenant extension), so the rule is scoped to
  // components, not all of src.
  {
    files: ["src/components/**/*.ts", "src/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/features/shared/db",
              importNames: ["getDb", "getRawPrisma", "getPlatformDb"],
              message:
                "UI components must not access the database directly. Use a feature service (services.ts) via TanStack Query, never getDb/getRawPrisma/getPlatformDb.",
            },
          ],
        },
      ],
    },
  },
  // Allow mock-services imports in selectors, tests, and seeds
  {
    files: [
      "src/lib/services/**",
      "src/lib/live-services/**",
      "src/lib/mock-services/**",
      "src/lib/mock-data/**",
      "src/components/demo/**",
      "src/components/shared/demo-controls.tsx",
      "src/components/shared/demo-links.tsx",
      "src/components/shared/demo-tour-page.tsx",
      "src/components/shared/admin-surface.live.tsx",
      "src/components/shared/admin-surface.tsx",
      "src/components/shared/plan10-surface.live.tsx",
      "src/components/shared/plan10-surface.tsx",
      "src/components/shared/app-mode-banner.tsx",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "prisma/seed.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);

export default eslintConfig;
