"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/lib/utils";

/** Small "signed-in as" indicator shown in the manager/staff/admin shells. */
export function AuthBanner({ className }: { className?: string }) {
  const { user, signOut } = useAuth();

  if (!user) {
    return (
      <Link
        href="/login"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        <User className="size-3.5" /> Sign in
      </Link>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <span className="truncate">
        <span className="font-medium text-foreground">{user.name}</span> · {user.role}
      </span>
      <ConfirmDialog
        trigger={
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        }
        title="Sign out?"
        description="You'll need to log in again to access your dashboard."
        confirmLabel="Sign out"
        onConfirm={signOut}
      />
    </div>
  );
}
