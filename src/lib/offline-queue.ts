const STORAGE_KEY = "nln-offline-queue";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface OfflineCommand {
  commandId: string;
  command: "placeOrder" | "fileIncident" | "clockIn" | "clockOut";
  payload: Record<string, unknown>;
  queuedAt: number;
  userId: string;
  venueId: string;
}

export type CommandStatus = "queued" | "syncing" | "sent" | "failed";

export interface QueueEntry {
  command: OfflineCommand;
  status: CommandStatus;
  error?: string;
}

function readQueue(): QueueEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueueEntry[];
  } catch {
    return [];
  }
}

function writeQueue(q: QueueEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
}

export function enqueue(command: OfflineCommand): void {
  const q = readQueue();
  if (q.some((e) => e.command.commandId === command.commandId)) return;
  q.push({ command, status: "queued" });
  writeQueue(q);
}

export function markSyncing(commandId: string): void {
  const q = readQueue();
  const entry = q.find((e) => e.command.commandId === commandId);
  if (entry) entry.status = "syncing";
  writeQueue(q);
}

export function markSent(commandId: string): void {
  const q = readQueue().filter((e) => e.command.commandId !== commandId);
  writeQueue(q);
}

export function markFailed(commandId: string, error: string): void {
  const q = readQueue();
  const entry = q.find((e) => e.command.commandId === commandId);
  if (entry) {
    entry.status = "failed";
    entry.error = error;
  }
  writeQueue(q);
}

export function getPending(): QueueEntry[] {
  return readQueue()
    .filter((e) => Date.now() - e.command.queuedAt < MAX_AGE_MS);
}

export function getFailed(): QueueEntry[] {
  return getPending().filter((e) => e.status === "failed");
}

export function retry(commandId: string): void {
  const q = readQueue();
  const entry = q.find((e) => e.command.commandId === commandId);
  if (entry) entry.status = "queued";
  writeQueue(q);
}

export function discard(commandId: string): void {
  const q = readQueue().filter((e) => e.command.commandId !== commandId);
  writeQueue(q);
}

export async function syncQueue(
  isOnline: boolean,
  send: (cmd: OfflineCommand) => Promise<{ ok: boolean; error?: string }>,
): Promise<void> {
  if (!isOnline) return;
  const pending = getPending().filter((e) => e.status !== "syncing");
  for (const entry of pending) {
    markSyncing(entry.command.commandId);
    const result = await send(entry.command);
    if (result.ok) {
      markSent(entry.command.commandId);
    } else {
      markFailed(entry.command.commandId, result.error ?? "Sync failed");
    }
  }
}

export function clearExpired(): void {
  const q = readQueue().filter((e) => Date.now() - e.command.queuedAt < MAX_AGE_MS);
  writeQueue(q);
}
