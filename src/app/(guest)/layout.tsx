import { GuestProvider } from "@/context/guest-context";

/**
 * Guest surface shell — phone-width column even on desktop so the
 * portal always feels like a native mobile app.
 */
export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col border-x border-border/40 bg-background">
        {children}
      </div>
    </GuestProvider>
  );
}
