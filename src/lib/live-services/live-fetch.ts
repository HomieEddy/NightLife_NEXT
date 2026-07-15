import { assertLiveMode } from "@/lib/app-mode";

export function liveFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  assertLiveMode();
  return fetch(input, init);
}
