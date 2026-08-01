import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Menu routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { getGuestAccess } = await import("@/features/guests/guest-auth");
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listCategories } = await import("@/features/menu/core");

  const guest = await getGuestAccess(request);
  const auth = guest ? null : await requireApiArea("staff");
  if (auth && "error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const includeInactive = !guest && request.nextUrl.searchParams.get("includeInactive") === "true";
  const venueId = guest?.venueId ?? sessionToDbContext(auth!.session).venueId;
  const db = getDb({ venueId });
  return NextResponse.json(await listCategories(db, includeInactive));
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { createCategory } = await import("@/features/menu/core");
  const { zCategoryInput } = await import("@/features/menu/schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zCategoryInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const category = await createCategory(db, venueId, parsed.data);
  return NextResponse.json(category, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
