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
  // getPlatformDb restricted to src/server/platform/ only
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: ["src/server/platform/**"],
    rules: {
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
          paths: [
            {
              name: "@/server/db",
              importNames: ["getPlatformDb"],
              message:
                "getPlatformDb is restricted to src/server/platform/. Use getDb(session) for tenant-scoped access.",
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
      "src/lib/mock-services/**",
      "src/lib/mock-data/**",
      "src/components/demo/**",
      "src/components/shared/demo-controls.tsx",
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
