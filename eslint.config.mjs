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
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/mock-services/*", "*/mock-services/*"],
              message:
                "Import from @/lib/services/ instead. Mock services are only allowed in selectors, tests, and seeds.",
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
              group: ["@/lib/mock-services/*", "*/mock-services/*"],
              message:
                "Import from @/lib/services/ instead. Mock services are only allowed in selectors, tests, and seeds.",
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
