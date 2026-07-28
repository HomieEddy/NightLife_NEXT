"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Minus, Plus, QrCode, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { BottleIcon } from "@/components/shared/bottle-icon";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { DemoQrScanAction } from "@/components/shared/demo-links";
import { PageHeader } from "@/components/shared/page-header";
import { ClosureGate } from "@/components/guest/closure-gate";
import { useGuest } from "@/context/guest-context";
import { menuService } from "@/lib/services/menu-service";
import { ordersService } from "@/lib/services/orders-service";
import { venueService } from "@/lib/services/venue-service";
import { formatMoney } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import type { MenuItem, VenueTable } from "@/lib/types";

const MAX_GIFT_PRICE = 60;

interface GiftLine {
  menuItem: MenuItem;
  quantity: number;
}

export default function GuestGiftPage() {
  const router = useRouter();
  const { table, guestName, sessionId } = useGuest();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<VenueTable[]>([]);
  const [lines, setLines] = useState<GiftLine[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
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

  const visible = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
    );
  }, [items, query]);

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;
  const subtotal = lines.reduce((sum, l) => sum + l.menuItem.price * l.quantity, 0);

  function addItem(item: MenuItem) {
    setLines((prev) => {
      const existing = prev.find((l) => l.menuItem.id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.menuItem.id === item.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  }

  function updateLineQty(itemId: string, qty: number) {
    setLines((prev) =>
      qty <= 0 ? prev.filter((l) => l.menuItem.id !== itemId) : prev.map((l) =>
        l.menuItem.id === itemId ? { ...l, quantity: qty } : l,
      ),
    );
  }

  async function send() {
    if (!table || lines.length === 0 || !selectedTable) return;
    setSending(true);
    await ordersService.sendGift({
      fromTableId: table.tableId,
      fromTableCode: table.tableCode,
      fromZoneId: table.zoneId,
      fromZoneName: table.zoneName,
      guestName: guestName || "Guest",
      sessionId: sessionId ?? undefined,
      items: lines,
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
          action={<DemoQrScanAction />}
        />
      </div>
    );
  }

  return (
    <ClosureGate>
    <div className="space-y-5 p-4 animate-fade-in">
      <PageHeader
        title="Send a bottle"
        description="Surprise another table — it's billed to you, they just get the delivery."
      />

      {lines.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Your gift</p>
          <ul className="space-y-1.5">
            {lines.map((line) => (
              <li key={line.menuItem.id} className="flex items-center gap-2 rounded-lg border p-2">
                <BottleIcon icon={line.menuItem.icon} className="size-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.menuItem.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatMoney(line.menuItem.price * line.quantity)}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-md border">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => updateLineQty(line.menuItem.id, line.quantity - 1)}
                    aria-label="Decrease"
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-5 text-center text-sm font-medium tabular-nums">
                    {line.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => updateLineQty(line.menuItem.id, line.quantity + 1)}
                    aria-label="Increase"
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-sm font-medium">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatMoney(subtotal)}</span>
          </div>
          <Separator />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Add items</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search bottles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 pl-9"
          />
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing giftable in stock right now.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {visible.map((item) => {
              const inCart = lines.find((l) => l.menuItem.id === item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addItem(item)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border p-2.5 text-left transition-colors",
                    inCart
                      ? "border-primary bg-primary/10"
                      : "hover:border-primary/40",
                  )}
                >
                  <BottleIcon icon={item.icon} className="size-9 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{formatMoney(item.price)}</p>
                    {inCart && (
                      <p className="text-xs font-medium text-primary">{inCart.quantity} in gift</p>
                    )}
                  </div>
                </button>
              );
            })}
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
          lines.length > 0 && selectedTable
            ? `${lines.map((l) => `${l.quantity}× ${l.menuItem.name}`).join(", ")} (${formatMoney(subtotal)}) goes on your tab, delivered to ${selectedTable.code}.`
            : "Pick at least one item and a table first."
        }
        confirmLabel="Send gift"
        onConfirm={send}
        trigger={
          <Button
            size="lg"
            className="h-12 w-full glow-primary"
            disabled={sending || lines.length === 0 || !selectedTable}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-4" />}
            {sending
              ? "Sending…"
              : lines.length === 0
                ? "Add items to send"
                : `Send gift · ${formatMoney(subtotal)}`}
          </Button>
        }
      />
    </div>
    </ClosureGate>
  );
}
