/**
 * Dual-mode selector (AD-14). Unset or "demo" = sandbox with mock services,
 * no DB required. "live" = real backend with Postgres.
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_APP_MODE !== "live";
}
