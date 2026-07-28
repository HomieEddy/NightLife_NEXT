const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_KEY ?? "";

let registration: ServiceWorkerRegistration | null = null;

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (registration) return registration;
  try {
    registration = await navigator.serviceWorker.register("/sw.js", {
      updateViaCache: "none",
    });
    registration.addEventListener("updatefound", () => {
      const installing = registration!.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent("nln:update-available"));
        }
      });
    });
    return registration;
  } catch {
    return null;
  }
}

export function onUpdateAvailable(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("nln:update-available", handler);
  return () => window.removeEventListener("nln:update-available", handler);
}

export async function applyUpdate(): Promise<void> {
  if (!registration?.waiting) return;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  window.location.reload();
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!("Notification" in window)) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const sw = registration ?? (await registerSW());
  if (!sw) return null;

  try {
    const sub = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as BufferSource,
    });
    return sub;
  } catch {
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  const sw = registration ?? (await registerSW());
  if (!sw) return false;
  try {
    const sub = await sw.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  const sw = registration ?? (await registerSW());
  if (!sw) return null;
  try {
    return await sw.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
