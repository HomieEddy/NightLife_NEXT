import { assertLiveMode } from "@/lib/app-mode";

function rejectLiveResource(): never {
  assertLiveMode();
  throw new Error("Live resources are unavailable in the demo build");
}

export const auth = new Proxy({}, { get: rejectLiveResource });
export const getDb = rejectLiveResource;
export const getPlatformDb = rejectLiveResource;
export const getRawPrisma = rejectLiveResource;
