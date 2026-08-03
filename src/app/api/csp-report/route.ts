import { NextResponse, type NextRequest } from "next/server";
import { logger } from "@/features/shared/logger";
import { checkRateLimit, getClientIp } from "@/features/shared/rate-limit";

/**
 * Report-only CSP violation collector (plan 31). Browsers POST JSON reports
 * to the `report-uri` in the report-only Content-Security-Policy header, so
 * the gap between report-only and enforced CSP can be measured before
 * flipping to enforcement. Never blocks anything — logging only.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`csp-report:ip:${ip}`, {
    maxTokens: 60,
    refillRate: 60,
    windowMs: 60_000,
  });
  if (!rl.allowed) return new NextResponse(null, { status: 429 });

  try {
    const report = await request.json();
    const entry =
      report?.["csp-report"] ?? report?.["csp-report-violation"] ?? report;
    // Strip query strings from URIs — document-uri can carry PII.
    const uri = (v: unknown) =>
      typeof v === "string" ? v.split("?")[0] : undefined;
    logger.warn("csp-violation", {
      blockedUri: uri(entry?.["blocked-uri"]),
      documentUri: uri(entry?.["document-uri"]),
      violatedDirective: entry?.["violated-directive"],
      effectiveDirective: entry?.["effective-directive"],
    });
  } catch {
    // Malformed body — not worth an error line.
  }
  return new NextResponse(null, { status: 204 });
}
