export type AppMode = "demo" | "live";

export function parseAppMode(value: string | undefined): AppMode {
  if (value === "demo" || value === "live") return value;
  throw new Error('NEXT_PUBLIC_APP_MODE must be explicitly set to "demo" or "live"');
}

export const APP_MODE = parseAppMode(process.env.NEXT_PUBLIC_APP_MODE);

export function getAppMode(): AppMode {
  return APP_MODE;
}

export function isDemoMode(): boolean {
  return APP_MODE === "demo";
}

export function assertDemoMode(): void {
  if (getAppMode() !== "demo") throw new Error("This operation is available only in demo mode");
}

export function assertLiveMode(): void {
  if (getAppMode() !== "live") throw new Error("This operation is available only in live mode");
}

type ModeReader = () => AppMode;

function modeOnlyService<T extends object>(
  service: T,
  expected: AppMode,
  readMode: ModeReader,
): T {
  return new Proxy(service, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        if (readMode() !== expected) {
          throw new Error(`This service is available only in ${expected} mode`);
        }
        return value.apply(target, args);
      };
    },
  });
}

export function demoOnlyService<T extends object>(
  service: T,
  readMode: ModeReader = getAppMode,
): T {
  return modeOnlyService(service, "demo", readMode);
}

export function liveOnlyService<T extends object>(
  service: T,
  readMode: ModeReader = getAppMode,
): T {
  return modeOnlyService(service, "live", readMode);
}
