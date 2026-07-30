import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "File-from-template routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { fileFromTemplate } = await import("@/features/safety/core");
  const { zFileFromTemplate } = await import("@/features/safety/schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const { id } = await params;
  const body = await request.json();
  const parsed = zFileFromTemplate.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  try {
    const incident = await fileFromTemplate(db, venueId, id, parsed.data.placeholders, parsed.data);
    return NextResponse.json(incident, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "Template not found") {
      return NextResponse.json({ error: "Template not found" }, { status: 403 });
    }
    throw err;
  }
}

export const POST = isDemoMode() ? demoHandler : livePOST;
