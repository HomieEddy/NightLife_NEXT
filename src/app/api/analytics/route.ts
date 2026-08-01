import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Analytics routes are disabled in demo mode" }, { status: 404 });
}

async function liveHandler(request: NextRequest, method: string) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb, getRawPrisma } = await import("@/features/shared/db");
  const { getSummaryForVenue, getHistoricalForVenue } = await import("@/features/analytics/analytics-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  // Resolve night config
  const venue = await getRawPrisma().venue.findUnique({
    where: { id: venueId },
    select: { timezone: true, nightStartHour: true, nightEndHour: true },
  });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  const nightConfig = venue; // { timezone, nightStartHour, nightEndHour } IS NightConfig

  // Phase 4 analytics depth routes
  if (type === "comparison") {
    const { getNightComparison } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getNightComparison(db, venueId, nightConfig));
  }
  if (type === "forecast") {
    const { getNightForecast } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getNightForecast(db, venueId, nightConfig));
  }
  if (type === "per-hour") {
    const { getPerHourAnalytics } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getPerHourAnalytics(db, venueId, nightConfig, from, to));
  }
  if (type === "door-to-table") {
    const { getDoorToTableFunnel } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getDoorToTableFunnel(db, venueId, nightConfig, from, to));
  }
  if (type === "table-turn") {
    const { getTableTurnAnalytics } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getTableTurnAnalytics(db, venueId, nightConfig, from, to));
  }
  if (type === "order-sla") {
    const { getOrderSlaAnalytics } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getOrderSlaAnalytics(db, venueId, nightConfig, from, to));
  }
  if (type === "comp-void") {
    const { getCompVoidRatioAnalytics } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getCompVoidRatioAnalytics(db, venueId, nightConfig, from, to));
  }
  if (type === "promoter-performance") {
    const { getPromoterPerformanceReport } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getPromoterPerformanceReport(db, venueId, nightConfig, from, to));
  }
  if (type === "incident-pattern") {
    const { getIncidentPatternReport } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getIncidentPatternReport(db, venueId, nightConfig, from, to));
  }
  if (type === "guest-retention") {
    const { getGuestRetentionMetrics } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getGuestRetentionMetrics(db, venueId, nightConfig, from, to));
  }
  if (type === "bottle-service") {
    const { getBottleServiceAnalytics } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getBottleServiceAnalytics(db, venueId, nightConfig, from, to));
  }
  if (type === "capacity") {
    const { getCapacityUtilizationAnalytics } = await import("@/features/analytics/analytics-depth");
    return NextResponse.json(await getCapacityUtilizationAnalytics(db, venueId, nightConfig, from, to));
  }
  if (type === "night-summary") {
    const { getNightSummary } = await import("@/features/analytics/analytics-depth");
    const businessDate = url.searchParams.get("date") ?? undefined;
    return NextResponse.json(await getNightSummary(db, venueId, nightConfig, businessDate));
  }

  // POST: CSV export
  if (method === "POST" && type === "export-csv") {
    const { exportReportCsv } = await import("@/features/analytics/analytics-depth");
    const body = await request.json().catch(() => null);
    if (!body || !body.metrics || !body.from || !body.to) {
      return NextResponse.json({ error: "Missing metrics, from, or to in request body" }, { status: 400 });
    }
    const result = await exportReportCsv(
      db,
      body.reportName ?? "Analytics Export",
      body.metrics,
      body.from,
      body.to,
      body.recipient,
    );
    return NextResponse.json(result);
  }

  // Legacy: historical range
  if (from && to) {
    const data = await getHistoricalForVenue(db, from, to);
    return NextResponse.json(data);
  }

  // Legacy: tonight summary
  const summary = await getSummaryForVenue(db, venueId, nightConfig);
  return NextResponse.json(summary);
}

async function liveGET(request: NextRequest) {
  return liveHandler(request, "GET");
}

async function livePOST(request: NextRequest) {
  return liveHandler(request, "POST");
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
