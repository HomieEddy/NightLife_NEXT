import { createQueue, createWorker } from "./connection";
import { JobType } from "./types";
import { logger } from "@/features/shared/logger";

export type JobProcessor = (payload: Record<string, unknown>) => Promise<void>;

const processors = new Map<string, JobProcessor>();

export function registerJob(type: string, processor: JobProcessor): void {
  processors.set(type, processor);
}

export function startWorkers(): void {
  for (const [type, processor] of processors) {
    const worker = createWorker(type, async (job) => {
      logger.info(`Processing job ${type}`);
      await processor(job.data as Record<string, unknown>);
    });
    if (worker) {
      logger.info(`Worker started for "${type}"`);
    }
  }
}

/** Enqueue a job; no-op when REDIS_URL is absent (cron handles it). */
export async function enqueue(type: string, payload: Record<string, unknown>): Promise<void> {
  const queue = createQueue(type);
  if (!queue) return;
  await queue.add(type, payload);
}

// ── Registration at import time ────────────────────────────────────────

registerJob(JobType.NightlyRollup, async (payload) => {
  logger.info("Nightly rollup stub", { venueId: payload.venueId, nightLabel: payload.nightLabel });
});

registerJob(JobType.ReservationReminders, async (payload) => {
  logger.info("Reservation reminders stub", { venueId: payload.venueId });
});

registerJob(JobType.ReportSchedules, async (payload) => {
  logger.info("Report schedules stub", { venueId: payload.venueId });
});
