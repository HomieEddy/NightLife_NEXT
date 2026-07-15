export function resolveAppOrigin(value: string | undefined, fallback: string): string {
  const url = new URL(value || fallback);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("App origin must use http or https");
  }
  return url.origin;
}

export const DEMO_APP_URL = resolveAppOrigin(
  process.env.NEXT_PUBLIC_DEMO_URL,
  "http://localhost:3001",
);

export const LIVE_APP_URL = resolveAppOrigin(
  process.env.NEXT_PUBLIC_LIVE_URL,
  "http://localhost:3000",
);
