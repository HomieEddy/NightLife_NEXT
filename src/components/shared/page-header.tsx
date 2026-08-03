import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Slash } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/features/shared/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string; // absent = current page (rendered as plain text)
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  backLink,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Optional breadcrumb trail rendered above the title on all routes 2+ segments past root. */
  breadcrumbs?: BreadcrumbItem[];
  /** A back link that preserves the previous page's state (e.g. list filters). */
  backLink?: string;
  className?: string;
}) {
  const t = useTranslations("shared.actions");
  return (
    <div className={cn("space-y-3", className)}>
      {(breadcrumbs && breadcrumbs.length > 0) && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1">
              {i > 0 && <Slash className="size-3" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      {backLink && (
        <Link
          href={backLink}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-3.5" /> {t("back")}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-display text-2xl sm:text-3xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
      </div>
      <hr className="rule-gold" aria-hidden="true" />
    </div>
  );
}
