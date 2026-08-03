import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/fx/reveal";
import {
  demoKeys,
  featureAnchorId,
  type DemoFeature,
  type DemoMessageKey,
  type Surface,
} from "./demo-guide-content";

const SURFACE_BADGE: Record<Surface, { labelKey: DemoMessageKey; className: string }> = {
  manager: { labelKey: "chrome.surfaceManager", className: "border-violet-500/40 text-violet-500 dark:text-violet-400" },
  staff: { labelKey: "chrome.surfaceStaff", className: "border-fuchsia-500/40 text-fuchsia-500 dark:text-fuchsia-400" },
  guest: { labelKey: "chrome.surfaceGuest", className: "border-cyan-500/40 text-cyan-500 dark:text-cyan-400" },
  public: { labelKey: "chrome.surfacePublic", className: "border-emerald-500/40 text-emerald-500 dark:text-emerald-400" },
};

export function DemoFeatureBlock({ feature }: { feature: DemoFeature }) {
  const t = useTranslations("demo");
  const badge = SURFACE_BADGE[feature.surface] ?? SURFACE_BADGE.manager;

  return (
    <Reveal>
      <div
        id={featureAnchorId(feature)}
        className="scroll-mt-24 rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur transition-colors hover:border-gold/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gold/30 bg-gold/10">
              <feature.icon className="size-4 text-gold-deep dark:text-gold" />
            </div>
            <h3 className="text-base font-semibold">{t(demoKeys.feature(feature, "title"))}</h3>
          </div>
          <Badge variant="outline" className={`shrink-0 text-[0.65rem] ${badge.className}`}>
            {t(badge.labelKey)}
          </Badge>
        </div>

        <div className="mt-3 space-y-1.5">
          <p className="text-sm font-medium text-foreground/90">
            {t(demoKeys.feature(feature, "what"))}
          </p>
          <p className="text-voice text-sm text-muted-foreground">
            {t(demoKeys.feature(feature, "why"))}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="label-luxe text-muted-foreground/70">
            {t("chrome.tryIt")} {t(demoKeys.feature(feature, "tryPath"))}
          </span>
          <Link
            href={feature.href}
            className="inline-flex items-center gap-1 text-xs font-medium text-gold-deep hover:underline dark:text-gold"
          >
            {t("chrome.open")} <ExternalLink className="size-3" />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
