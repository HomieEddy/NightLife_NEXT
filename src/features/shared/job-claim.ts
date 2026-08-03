import type { PrismaClient } from "@prisma/client";

/** A run stuck in "running" longer than this is considered crashed and stealable. */
export const STALE_RUN_MS = 30 * 60_000;

/**
 * Atomically claims a job run for (tenantId, jobName) — the unique
 * (tenant_id, job_name) constraint makes `createMany skipDuplicates` the
 * claim: a concurrent invocation (or a retry after a crash) cannot double-run.
 * A crashed run (status "running", startedAt older than STALE_RUN_MS) is
 * stolen so it doesn't block the next run forever.
 *
 * Returns true when this invocation should do the work.
 */
export async function claimJobRun(
  prisma: PrismaClient,
  tenantId: string,
  jobName: string,
): Promise<boolean> {
  const claimed = await prisma.jobRun.createMany({
    data: { tenantId, jobName, status: "running", startedAt: new Date() },
    skipDuplicates: true,
  });
  if (claimed.count > 0) return true;

  const stale = await prisma.jobRun.findFirst({
    where: {
      tenantId,
      jobName,
      status: "running",
      startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) },
    },
  });
  if (!stale) return false;
  await prisma.jobRun.update({
    where: { id: stale.id },
    data: { startedAt: new Date() },
  });
  return true;
}

/** Mark the claimed run completed. */
export async function completeJobRun(
  prisma: PrismaClient,
  tenantId: string,
  jobName: string,
): Promise<void> {
  await prisma.jobRun.updateMany({
    where: { tenantId, jobName, status: "running" },
    data: { status: "completed", endedAt: new Date() },
  });
}

/** Mark the claimed run failed (the catch path — keeps the audit honest). */
export async function failJobRun(
  prisma: PrismaClient,
  tenantId: string,
  jobName: string,
): Promise<void> {
  await prisma.jobRun.updateMany({
    where: { tenantId, jobName, status: "running" },
    data: { status: "failed", endedAt: new Date() },
  });
}
