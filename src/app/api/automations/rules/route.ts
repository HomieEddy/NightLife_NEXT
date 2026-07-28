import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Automation routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb, getRawPrisma } = await import("@/server/db");
  const { listRules, ensureRules } = await import("@/server/automation-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  // Seed defaults if no rules exist yet
  const rawPrisma = getRawPrisma();
  const count = await rawPrisma.automationRule.count({ where: { venueId } });
  if (count === 0) {
    await ensureRules(rawPrisma, venueId);
  }

  const rules = await listRules(db);
  return NextResponse.json(rules);
}

async function livePATCH(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { setRuleEnabled, updateRuleConfig } = await import("@/server/automation-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const body = await request.json().catch(() => null);
  if (!body || !body.ruleId) {
    return NextResponse.json({ error: "Missing ruleId in request body" }, { status: 400 });
  }

  if (typeof body.enabled === "boolean") {
    const rule = await setRuleEnabled(db, body.ruleId, body.enabled);
    return NextResponse.json(rule);
  }

  if (body.config && typeof body.config === "object") {
    const rule = await updateRuleConfig(db, body.ruleId, body.config);
    return NextResponse.json(rule);
  }

  return NextResponse.json({ error: "Provide enabled (boolean) or config (object) to update" }, { status: 400 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const PATCH = isDemoMode() ? demoHandler : livePATCH;
