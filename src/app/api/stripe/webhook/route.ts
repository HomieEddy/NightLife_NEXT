import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Not available" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { constructWebhookEvent, handleWebhookEvent } = await import("@/features/platform/stripe");
  const { getPlatformDb } = await import("@/features/shared/db");

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await request.text();

  let event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  await handleWebhookEvent(getPlatformDb(), event);
  return NextResponse.json({ received: true });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
