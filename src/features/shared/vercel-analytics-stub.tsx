/**
 * Live-mode stub for `@vercel/analytics/react`, swapped in via turbopack
 * resolveAlias (next.config.ts). Vercel Web Analytics tracks the demo app
 * only — the demo build deploys to Vercel, the live build to OVHcloud
 * (AD-15) and owns its analytics stack. Rendering null keeps the live
 * bundle free of the SDK no matter where the component is mounted.
 */
export function Analytics() {
  return null;
}
