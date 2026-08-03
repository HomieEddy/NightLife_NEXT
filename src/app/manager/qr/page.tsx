"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Printer, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DemoManagerGuestFlowAction } from "@/components/shared/demo-links";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { venueService } from "@/features/venue/services";
import { venueKeys } from "@/features/venue/query-keys";
import { useAuth } from "@/context/auth-context";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/features/shared/utils";
import type { TableStatus, VenueTable } from "@/lib/types";

/** Real, scannable QR rendered as inline SVG. */
function QrSvg({ url, className }: { url: string; className?: string }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(setSvg);
  }, [url]);
  return (
    <div
      className={className}
      // qrcode emits trusted, locally-generated SVG only
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

const STATUS_FILTER_VALUES = ["all", "open", "occupied", "reserved", "closed"] as const;

export default function ManagerQrPage() {
  const t = useTranslations("manager.qr");
  const ts = useTranslations("shared");
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<TableStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const { data: tables } = useQuery({
    queryKey: venueKeys.tables(venueId),
    queryFn: () => venueService.listTables(),
    enabled: !!venueId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const tableUrl = (table: VenueTable) => `${origin}/g/${table.qrSlug}`;

  function copyLink(table: VenueTable) {
    navigator.clipboard.writeText(tableUrl(table)).then(
      () => toast.success(t("linkCopied", { code: table.code })),
      () => toast.error(t("couldNotCopyLink")),
    );
  }

  async function downloadPng(table: VenueTable) {
    try {
      const dataUrl = await QRCode.toDataURL(tableUrl(table), { width: 1024, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-${table.code.toLowerCase()}.png`;
      a.click();
      toast.success(t("qrDownloaded", { code: table.code }));
    } catch {
      toast.error(t("couldNotGenerateQr", { code: table.code }));
    }
  }

  async function regenerateToken(table: VenueTable) {
    try {
      await venueService.regenerateToken(table.id);
      toast.success(t("qrRegenerated", { code: table.code }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("couldNotRegenerate", { code: table.code }));
    }
  }

  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? "";
  const visible = useMemo(
    () => (tables ?? []).filter((t) => {
      if (zoneFilter !== "all" && t.zoneId !== zoneFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (!`${t.code} ${t.label} ${zoneName(t.zoneId)}`.toLowerCase().includes(q)) return false;
      }
      return true;
    }),
    [tables, zoneFilter, statusFilter, query, zones],
  );

  return (
    <>
      <div className="space-y-5 print:hidden">
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t("allZones")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allZones")}</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" /> {t("printSheet")}
              </Button>
              <DemoManagerGuestFlowAction />
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t("searchPlaceholder")}
            className="w-full sm:w-56"
          />
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_VALUES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                  statusFilter === s
                    ? "border-primary bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? ts("all") : s}
              </button>
            ))}
          </div>
        </div>

        {tables === undefined || !origin ? (
          <ListSkeleton rows={6} rowHeight="h-24" />
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            <QrCode className="mx-auto mb-2 size-8 opacity-30" />
            {t("noTablesMatch")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((table) => (
              <Card key={table.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col items-center gap-3 p-4">
                  <div className="flex w-full items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{table.code}</p>
                      <p className="text-xs text-muted-foreground">
                        {zoneName(table.zoneId)} · <StatusBadge status={table.status} />
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon" className="size-8" aria-label={t("regenerateAria", { code: table.code })}>
                            <RefreshCw className="size-3.5" />
                          </Button>
                        }
                        title={t("regenerateToken")}
                        description={t("regenerateDesc")}
                        confirmLabel={t("regenerate")}
                        onConfirm={() => regenerateToken(table)}
                      />
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => copyLink(table)} aria-label={t("copyLinkAria", { code: table.code })}>
                        <Copy className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => downloadPng(table)} aria-label={t("downloadAria", { code: table.code })}>
                        <Download className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <QrSvg url={tableUrl(table)} className="size-32 rounded-lg bg-white p-1.5" />
                  <p className="w-full break-all text-center text-[0.7rem] leading-tight text-muted-foreground select-all">{tableUrl(table)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Print-friendly sheet */}
      <div className="hidden print:block">
        <h2 className="mb-4 text-center text-lg font-bold">{t("printHeading")}</h2>
        <div className="grid grid-cols-2 gap-4">
          {(tables ?? []).map((table) => (
            <div key={table.id} className="flex flex-col items-center gap-1 border p-3 text-center">
              <p className="text-sm font-semibold">{table.code}</p>
              <QrSvg url={tableUrl(table)} className="size-28 rounded bg-white p-1" />
              <p className="text-[0.6rem] text-muted-foreground break-all">{tableUrl(table)}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
