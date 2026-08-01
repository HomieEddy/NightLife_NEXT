"use client";

import { useEffect, useState } from "react";
import { registerSW, onUpdateAvailable, applyUpdate } from "@/lib/pwa";
import { Button } from "@/components/ui/button";
import { RefreshCw, WifiOff } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [updateReady, setUpdateReady] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    registerSW();
    const unsub = onUpdateAvailable(() => setUpdateReady(true));
    return () => unsub();
  }, []);

  useEffect(() => {
    const go = () => setOffline(false);
    const went = () => setOffline(true);
    window.addEventListener("online", go);
    window.addEventListener("offline", went);
    return () => {
      window.removeEventListener("online", go);
      window.removeEventListener("offline", went);
    };
  }, []);

  return (
    <>
      {updateReady && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-600 px-4 py-2 text-sm font-medium text-white">
          New version available
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={applyUpdate}
          >
            <RefreshCw className="mr-1 size-3" />
            Refresh
          </Button>
        </div>
      )}
      {offline && (
        <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">
          <WifiOff className="size-3.5" />
          You&apos;re offline — some actions are unavailable
        </div>
      )}
      {children}
    </>
  );
}
