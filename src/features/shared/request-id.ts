/** Generate a fresh request id for propagation through the handler chain. */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
