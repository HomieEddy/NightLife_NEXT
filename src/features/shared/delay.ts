/** Simulates network latency so the UI exercises its loading states. */
export function delay(ms = 350 + Math.random() * 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Deep-clone so callers can't mutate the store directly. */
export function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}
