import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { logger } from "@/features/shared/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthResponse {
  status: "ok" | "degraded";
  uptime: number;
  checks: {
    db: "ok" | "error";
    queue?: "ok" | "error" | "absent";
  };
}

const startTime = process.uptime();

function healthy(): NextResponse<HealthResponse> {
  return NextResponse.json({
    status: "ok",
    uptime: Math.round((process.uptime() - startTime) * 100) / 100,
    checks: { db: "ok" },
  });
}

function demoHandler(): NextResponse<HealthResponse> {
  return NextResponse.json({
    status: "ok",
    uptime: Math.round((process.uptime() - startTime) * 100) / 100,
    checks: { db: "ok" },
  });
}

async function dbCheck(): Promise<"ok" | "error"> {
  try {
    const { getRawPrisma } = await import("@/features/shared/db");
    const result = await Promise.race([
      getRawPrisma().$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DB timeout")), 3000),
      ),
    ]);
    return result ? "ok" : "error";
  } catch {
    return "error";
  }
}

async function liveHandler(request: NextRequest): Promise<NextResponse<HealthResponse>> {
  const { getClientIp, checkRateLimit } = await import(
    "@/features/shared/rate-limit"
  );
  const ip = getClientIp(request);
  const rl = checkRateLimit(`health:ip:${ip}`, {
    maxTokens: 30,
    refillRate: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        status: "degraded",
        uptime: Math.round((process.uptime() - startTime) * 100) / 100,
        checks: { db: "ok" },
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
    );
  }

  const db = await dbCheck();

  const res: HealthResponse = {
    status: db === "ok" ? "ok" : "degraded",
    uptime: Math.round((process.uptime() - startTime) * 100) / 100,
    checks: { db },
  };

  if (process.env.REDIS_URL) {
    try {
      const { default: Redis } = await import("ioredis");
      const client = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 0,
      });
      const pong = await Promise.race([
        client.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Redis timeout")), 2000),
        ),
      ]);
      res.checks.queue = pong === "PONG" ? "ok" : "error";
      await client.quit().catch(() => {});
    } catch {
      res.checks.queue = "error";
      res.status = "degraded";
    }
  }

  if (res.status === "degraded") {
    logger.error("health:degraded", { checks: res.checks });
    return NextResponse.json(res, { status: 503 });
  }

  return NextResponse.json(res);
}

export const GET = isDemoMode() ? demoHandler : liveHandler;
