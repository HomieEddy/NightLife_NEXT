import { Queue, Worker } from "bullmq";
import { logger } from "@/features/shared/logger";

const REDIS_URL = process.env.REDIS_URL;

/** ponytail: Redis-backed BullMQ when REDIS_URL is present, null in dev/demo */
const redis = REDIS_URL ? { connection: { url: REDIS_URL } } : null;

export function createQueue(name: string): Queue | null {
  if (!redis) {
    logger.warn(`Queue "${name}" skipped — REDIS_URL not configured`);
    return null;
  }
  return new Queue(name, redis);
}

export function createWorker(
  name: string,
  handler: (job: { data: unknown; id?: string }) => Promise<void>,
): Worker | null {
  if (!redis) return null;
  const worker = new Worker(name, handler, { ...redis, concurrency: 1 });
  worker.on("failed", (job, err) =>
    logger.error(`Job ${job?.id} failed`, { queue: name, error: String(err) }),
  );
  return worker;
}
