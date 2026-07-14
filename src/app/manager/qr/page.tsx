"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, Download, ExternalLink, Printer, QrCode, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { venueService } from "@/lib/services/venue-service";
import type { VenueTable, Zone } from "@/lib/types";
import { isDemoMode } from "@/lib/app-mode";

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

export default function ManagerQrPage() {
  const [tables, setTables] = useState<VenueTable[] | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneFilter, setZoneFilter] = useState("all");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    Promise.all([venueService.listTables(), venueService.listZones()]).then(
      ([tableList, zoneList]) => {
        setTables(tableList);
        setZones(zoneList);
      },
    );
  }, []);

  const tableUrl = useCallback(
    (table: VenueTable) => `${origin}/g/${table.qrSlug}`,
    [origin],
  );

  function copyLink(table: VenueTable) {
    navigator.clipboard.writeText(tableUrl(table)).then(
      () => toast.success(`Link for ${table.code} copied`),
      () => toast.error("Could not copy link"),
    );
  }

  async function downloadPng(table: VenueTable) {
    try {
      const dataUrl = await QRCode.toDataURL(tableUrl(table), { width: 1024, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `qr-${table.code.toLowerCase()}.png`;
      a.click();
      toast.success(`QR for ${table.code} downloaded`);
    } catch {
      toast.error(`Could not generate the QR for ${table.code}`);
    }
  }

  async function regenerateToken(table: VenueTable) {
    try {
      await venueService.regenerateToken(table.id);
      toast.success(`QR for ${table.code} regenerated — reprint the code to activate.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Could not regenerate ${table.code}`);
    }
  }

  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? "";
  const visible = useMemo(
    () => (tables ?? []).filter((t) => zoneFilter === "all" || t.zoneId === zoneFilter),
    [tables, zoneFilter],
  );

  return (
    <>
      <div className="space-y-5 print:hidden">
        <PageHeader
          title="QR codes"
          description="Each table gets a unique QR. Guests scan to join and order."
          actions={
            <div className="flex items-center gap-2">
              <Select value={zoneFilter} onValueChange={setZoneFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All zones" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All zones</SelectItem>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="size-4" /> Print sheet
              </Button>
              {isDemoMode() && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/g/demo-table">
                    <ExternalLink className="size-3.5" /> Test guest flow
                  </Link>
                </Button>
              )}
            </div>
          }
        />

        {tables === null || !origin ? (
          <ListSkeleton rows={6} rowHeight="h-24" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((table) => (
              <Card key={table.id} className="py-4">
                <CardContent className="flex items-center gap-4 px-4">
                  <QrSvg
                    url={tableUrl(table)}
                    className="size-16 shrink-0 overflow-hidden rounded-md border bg-white p-1 [&_svg]:size-full"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-semibold">{table.code}</p>
                      <StatusBadge status={table.status} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {table.label} · {zoneName(table.zoneId)}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                      /g/{table.qrSlug}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => copyLink(table)}>
                      <Copy className="size-3.5" /> Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadPng(table)}>
                      <Download className="size-3.5" /> PNG
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="outline">
                          <RefreshCw className="size-3.5" /> Regen
                        </Button>
                      }
                      title={`Regenerate QR for ${table.code}?`}
                      description="The current printed QR code will stop working. You'll need to reprint it."
                      confirmLabel="Regenerate"
                      destructive
                      onConfirm={() => regenerateToken(table)}
                    />
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/g/${table.qrSlug}`}>
                        <QrCode className="size-3.5" /> Open
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ---------- Print-only sheet (respects zone filter) ---------- */}
      <div className="hidden print:block">
        <div className="grid grid-cols-2 gap-6">
          {visible.map((table) => (
            <div
              key={table.id}
              className="flex break-inside-avoid flex-col items-center gap-2 rounded-xl border border-zinc-300 p-6 text-center"
            >
              <QrSvg url={tableUrl(table)} className="size-40 [&_svg]:size-full" />
              <p className="font-mono text-lg font-bold">{table.code}</p>
              <p className="text-sm text-zinc-600">
                {table.label} · {zoneName(table.zoneId)}
              </p>
              <p className="text-xs text-zinc-500">Scan to order at your table</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
