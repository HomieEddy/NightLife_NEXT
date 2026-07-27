"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, ShoppingCart, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { purchasingService } from "@/lib/services/purchasing-service";
import { menuService } from "@/lib/services/menu-service";
import { staffService } from "@/lib/services/staff-service";
import { suggestPurchaseOrder } from "@/lib/costs";
import { formatMoney } from "@/lib/format";
import type { PurchaseOrder, Supplier, SupplierItem, MenuItem } from "@/lib/types";

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  submitted: "secondary",
  "partially-received": "secondary",
  received: "default",
  cancelled: "outline",
};

export default function ManagerPurchasingPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [ready, setReady] = useState(false);
  const [suggestions, setSuggestions] = useState<
    { menuItemId: string; itemName: string; suggestedQty: number; unitCostCents: number | null; supplierSku?: string }[]
  >([]);
  const [meId, setMeId] = useState("");

  const refresh = useCallback(async () => {
    const [sups, pos, its, sis, me] = await Promise.all([
      purchasingService.listSuppliers(),
      purchasingService.listPurchaseOrders(),
      menuService.listItems(),
      purchasingService.listSupplierItems(),
      staffService.getCurrentStaff(),
    ]);
    setSuppliers(sups);
    setOrders(pos);
    setItems(its);
    setSupplierItems(sis);
    setMeId(me.id);
    setReady(true);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function computeSuggestions(supplierId: string) {
    const openPos = orders.filter((po) => po.status !== "received" && po.status !== "cancelled");
    const s = suggestPurchaseOrder(items, openPos, (new Date().getDay() + 1) % 7, supplierItems, supplierId);
    setSuggestions(s);
    toast.success(`Found ${s.length} items below par`);
  }

  async function submitPO(poId: string) {
    try {
      await purchasingService.submitPurchaseOrder(poId, meId);
      await refresh();
      toast.success("PO submitted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit PO");
    }
  }

  if (!ready) return <ListSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchasing"
        description="Suppliers, purchase orders and suggested ordering"
      />

      {suppliers.length === 0 ? (
        <EmptyState icon={Truck} title="No suppliers" description="Add your suppliers to start ordering." />
      ) : (
        suppliers.map((sup) => (
          <Card key={sup.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {sup.name}
                  {!sup.active && <Badge variant="outline">Inactive</Badge>}
                </span>
                <Button size="sm" variant="outline" onClick={() => computeSuggestions(sup.id)}>
                  <ShoppingCart className="size-4 mr-1" /> Check par levels
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Lead time: {sup.leadTimeDays} days · Min order: {sup.minimumOrderCents ? formatMoney(sup.minimumOrderCents, "CAD") : "none"}
              </p>

              {/* POs for this supplier */}
              {orders
                .filter((po) => po.supplierId === sup.id)
                .map((po) => (
                  <div key={po.id} className="rounded-md border px-3 py-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{po.code}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_BADGE[po.status] ?? "outline"}>{po.status}</Badge>
                        {po.status === "draft" && (
                          <ConfirmDialog
                            trigger={<Button size="sm">Submit</Button>}
                            title={`Submit ${po.code}?`}
                            description="Once submitted, the PO is sent to the supplier."
                            confirmLabel="Submit"
                            onConfirm={() => submitPO(po.id)}
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-1 space-y-1">
                      {po.lines.map((l) => {
                        const it = items.find((i) => i.id === l.menuItemId);
                        return (
                          <div key={l.id} className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{it?.name ?? l.menuItemId}</span>
                            <span className="tabular-nums">
                              {l.qtyReceived}/{l.qtyOrdered} × {formatMoney(l.unitCostCents, "CAD")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-xs font-semibold tabular-nums">{formatMoney(po.subtotalCents, "CAD")}</p>
                  </div>
                ))}
            </CardContent>
          </Card>
        ))
      )}

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="size-4" /> Suggested order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {suggestions.map((s) => (
                <div key={s.menuItemId} className="flex items-center justify-between rounded px-2 py-1 text-sm">
                  <span>{s.itemName}</span>
                  <span className="tabular-nums">
                    {s.suggestedQty} × {s.unitCostCents != null ? formatMoney(s.unitCostCents, "CAD") : "—"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
