"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Gift, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BottleIcon } from "@/components/shared/bottle-icon";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { useGuest } from "@/context/guest-context";
import { menuService } from "@/lib/services/menu-service";
import { ordersService } from "@/lib/services/orders-service";
import { venueService } from "@/lib/services/venue-service";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuItem, VenueTable } from "@/lib/types";

// Keeps the gift list to approachable, quick-to-deliver items.
const MAX_GIFT_PRICE = 60;

export default function GuestGiftPage() {
  const router = useRouter();
  const { table, guestName, sessionId } = useGuest();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!table) return;
    Promise.all([menuService.listItems(), venueService.listTables()]).then(
      ([allItems, allTables]) => {
        setItems(
          allItems.filter((i) => i.isAvailable && i.inventory > 0 && i.price <= MAX_GIFT_PRICE),
        );
        setTables(
          allTables.filter(
            (t) => t.id !== table.tableId && (t.status === "occupied" || t.status === "reserved"),
          ),
        );
      },
    );
  }, [table]);

  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;

  async function send() {
    if (!table || !selectedItem || !selectedTable) return;
    setSending(true);
    await ordersService.sendGift({
      fromTableId: table.tableId,
      fromTableCode: table.tableCode,
      fromZoneId: table.zoneId,
      fromZoneName: table.zoneName,
      guestName: guestName || "Guest",
      sessionId: sessionId ?? undefined,
      menuItem: selectedItem,
      toTableId: selectedTable.id,
      toTableCode: selectedTable.code,
      note: note.trim() || undefined,
    });
    setSending(false);
    toast.success(`Sent to ${selectedTable.code} — it's on your tab tonight`);
    router.push("/guest/orders");
  }

  if (!table) {
    return (
      <div className="p-6">
        <EmptyState
          icon={QrCode}
          title="No table joined"
          description="Scan the QR code on your table first."
          action={
            <Button asChild>
              <Link href="/g/demo-table">Simulate scanning a QR</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 animate-fade-in">
      <PageHeader
        title="Send a bottle"
        description="Surprise another table — it's billed to you, they just get the delivery."
      />

      <div className="space-y-2">
        <p className="text-sm font-medium">Pick something</p>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing giftable in stock right now.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedItemId(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-2.5 text-left transition-colors",
                  selectedItemId === item.id
                    ? "border-primary bg-primary/10"
                    : "hover:border-primary/40",
                )}
              >
                <BottleIcon icon={item.icon} className="size-9 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(item.price)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Send it to</p>
        {tables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other occupied tables right now.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tables.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTableId(t.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-mono text-sm transition-colors",
                  selectedTableId === t.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.code}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Add a note (optional)</p>
        <Textarea
          placeholder="e.g. From a secret admirer 😉"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
        />
      </div>

      <ConfirmDialog
        title="Send this gift?"
        description={
          selectedItem && selectedTable
            ? `${selectedItem.name} (${formatMoney(selectedItem.price)}) goes on your tab, delivered to ${selectedTable.code}.`
            : "Pick an item and a table first."
        }
        confirmLabel="Send gift"
        onConfirm={send}
        trigger={
          <Button
            size="lg"
            className="h-12 w-full glow-primary"
            disabled={sending || !selectedItem || !selectedTable}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
            {sending ? "Sending…" : "Send gift"}
          </Button>
        }
      />
    </div>
  );
}
