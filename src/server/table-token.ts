import { createHmac, timingSafeEqual } from "node:crypto";

const ALGORITHM = "sha256";

function getSecret(): string {
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("QR_TOKEN_SECRET must be set (min 16 chars)");
  }
  return secret;
}

export function signTableToken(tableId: string, tokenVersion: number): string {
  const payload = `${tableId}.${tokenVersion}`;
  return createHmac(ALGORITHM, getSecret()).update(payload).digest("base64url");
}

export function buildTableUrl(tableId: string, tokenVersion: number): string {
  const sig = signTableToken(tableId, tokenVersion);
  return `${tableId}.${sig}`;
}

export interface TokenResult {
  valid: boolean;
  tableId: string;
}

export function verifyTableToken(
  raw: string,
  lookupVersion: (tableId: string) => number | null,
): TokenResult {
  const dotIndex = raw.indexOf(".");
  if (dotIndex < 1) return { valid: false, tableId: "" };

  const tableId = raw.slice(0, dotIndex);
  const sig = raw.slice(dotIndex + 1);

  const version = lookupVersion(tableId);
  if (version === null) return { valid: false, tableId };

  const expected = signTableToken(tableId, version);
  if (sig.length !== expected.length) return { valid: false, tableId };

  const valid = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  return { valid, tableId };
}
