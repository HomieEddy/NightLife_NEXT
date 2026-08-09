"use client";

import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/context/auth-context";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { cn } from "@/features/shared/utils";

/** Small "signed-in as" indicator shown in the manager/staff/admin shells. */
export function AuthBanner({ className }: { className?: string }) {
  const { user, signOut } = useAuth();
  const t = useTranslations("auth");

  if (!user) {
    return (
      <Link
        href="/login"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        <User className="size-3.5" /> {t("login")}
      </Link>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      {/* Hidden on phones — the shell header already shows the name next to
          the avatar; keeping the text here would push the toggles off-screen. */}
      <span className="hidden min-w-0 truncate sm:block">
        <span className="font-medium text-foreground">{user.name}</span> · {user.role}
      </span>
      <ConfirmDialog
        trigger={
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:text-foreground"
            aria-label={t("logout")}
          >
            <LogOut className="size-3.5" />
          </button>
        }
        title={t("logoutTitle")}
        description={t("logoutDescription")}
        confirmLabel={t("logout")}
        onConfirm={signOut}
      />
    </div>
  );
}
