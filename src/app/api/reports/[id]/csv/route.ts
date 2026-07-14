import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Report routes are disabled in demo mode" }, { status: 404 });
}

type RouteContext = { params: Promise<{ id: string }> };

async function liveGET(_request: NextRequest, context: RouteContext) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { renderCsv } = await import("@/server/report-core");
  const { getHistoricalForVenue } = await import("@/server/analytics-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const report = await db.savedReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const to = new Date();
  const from = new Date(to.getTime() - report.rangeDays * 86_400_000);
  const fromISO = from.toISOString().slice(0, 10);
  const toISO = to.toISOString().slice(0, 10);

  const data = await getHistoricalForVenue(db, fromISO, toISO);
  const metrics = report.metrics as string[];
  const csv = renderCsv(report.name, metrics as Parameters<typeof renderCsv>[1], data);

  const filename = `${report.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
