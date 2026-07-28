/**
 * Cent-based money utilities. All money in the system is stored as integer
 * cents; these helpers convert at the boundary.
 */

export function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Split a total evenly across N shares, distributing remainder one cent at a
 * time to earlier shares. Sum of returned array always equals totalCents exactly.
 */
export function splitCents(totalCents: number, shares: number): number[] {
  if (shares <= 0) throw new Error("shares must be positive");
  const base = Math.floor(totalCents / shares);
  const remainder = totalCents - base * shares;
  return Array.from({ length: shares }, (_, i) =>
    i < remainder ? base + 1 : base
  );
}
