/**
 * SSE stream helper: subscribes to Postgres NOTIFY on a venue channel,
 * filters by audience, and streams matching events to the client.
 */
import { channelFor, AUDIENCE_FILTER, type DomainEventType } from "@/features/realtime/events";
import { getLiveEnv } from "@/features/shared/env";
import pg from "pg";

type Scope = "manager" | "staff" | "guest";

interface StreamOptions {
  venueId: string;
  scope: Scope;
  /** For guest scope: only events matching this sessionId pass through. */
  sessionId?: string;
  signal: AbortSignal;
}

/**
 * Creates a ReadableStream of SSE-formatted events backed by pg LISTEN.
 * The caller wraps this in a Response with the right headers.
 */
export function createEventStream(opts: StreamOptions): ReadableStream<Uint8Array> {
  const { venueId, scope, sessionId, signal } = opts;
  const allowedTypes = new Set<string>(AUDIENCE_FILTER[scope]);
  const channel = channelFor(venueId);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const env = getLiveEnv();
      const client = new pg.Client({ connectionString: env.DATABASE_URL });

      async function cleanup() {
        try {
          await client.query(`UNLISTEN ${quoteIdent(channel)}`);
          await client.end();
        } catch {
          // connection may already be dead
        }
      }

      signal.addEventListener("abort", () => {
        cleanup();
        controller.close();
      });

      try {
        await client.connect();
        await client.query(`LISTEN ${quoteIdent(channel)}`);

        // Heartbeat keeps the connection alive through proxies
        const heartbeat = setInterval(() => {
          if (signal.aborted) {
            clearInterval(heartbeat);
            return;
          }
          try {
            controller.enqueue(encoder.encode(": heartbeat\n\n"));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15_000);

        client.on("notification", (msg) => {
          if (signal.aborted || msg.channel !== channel || !msg.payload) return;

          try {
            const parsed = JSON.parse(msg.payload) as { type: string; sessionId?: string; [k: string]: unknown };

            if (!allowedTypes.has(parsed.type)) return;

            // Guest streams: filter to own session (except venue-wide events)
            if (scope === "guest" && sessionId) {
              const venueWide: DomainEventType[] = ["LastCallStarted", "LastCallEnded"];
              if (!venueWide.includes(parsed.type as DomainEventType) && parsed.sessionId !== sessionId) {
                return;
              }
            }

            const data = `data: ${JSON.stringify(parsed)}\n\n`;
            controller.enqueue(encoder.encode(data));
          } catch {
            // malformed payload — skip
          }
        });

        client.on("error", () => {
          clearInterval(heartbeat);
          cleanup();
          try { controller.close(); } catch { /* already closed */ }
        });

        client.on("end", () => {
          clearInterval(heartbeat);
          try { controller.close(); } catch { /* already closed */ }
        });
      } catch {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
