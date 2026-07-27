"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowUpDown, Package, Plus, Search, ShoppingCart, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { purchasingService } from "@/lib/services/purchasing-service";
import { menuService } from "@/lib/services/menu-service";
import { staffService } from "@/lib/services/staff-service";
import { suggestPurchaseOrder } from "@/lib/costs";
import { formatMoney } from "@/lib/format";
import type { PurchaseOrder, Stocktake, Supplier, SupplierItem, MenuItem } from "@/lib/types";

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = { draft: "outline", submitted: "secondary", "partially-received": "secondary", received: "default", cancelled: "outline" };

export default function ManagerPurchasingPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [ready, setReady] = useState(false);
  const [suggestions, setSuggestions] = useState<{ menuItemId: string; itemName: string; suggestedQty: number; unitCostCents: number | null }[]>([]);
  const [meId, setMeId] = useState("");
  const [busy, setBusy] = useState(false);

  // Filters
  const [supFilter, setSupFilter] = useState<string>("all");
  const [poStatusFilter, setPoStatusFilter] = useState<string>("all");
  const [stStatusFilter, setStStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("newest");

  // Supplier dialog
  const [supOpen, setSupOpen] = useState(false);
  const [supEditing, setSupEditing] = useState<Supplier | null>(null);
  const [supForm, setSupForm] = useState({ name: "", contactName: "", email: "", phone: "", leadTimeDays: "2", minOrder: "" });

  // PO create dialog
  const [poOpen, setPoOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poLines, setPoLines] = useState<{ menuItemId: string; qty: string }[]>([]);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    const [sups, pos, its, sis, sts, me] = await Promise.all([
      purchasingService.listSuppliers(), purchasingService.listPurchaseOrders(), menuService.listItems(),
      purchasingService.listSupplierItems(), purchasingService.listStocktakes(), staffService.getCurrentStaff(),
    ]);
    setSuppliers(sups); setOrders(pos); setItems(its); setSupplierItems(sis); setStocktakes(sts); setMeId(me.id); setReady(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Filtered data
  const filteredSuppliers = suppliers.filter((s) => (supFilter === "all" || s.id === supFilter) && (searchQuery ? s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.contactName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) : true));
  const filteredOrders = orders.filter((po) => {
    if (supFilter !== "all" && po.supplierId !== supFilter) return false;
    if (poStatusFilter !== "all" && po.status !== poStatusFilter) return false;
    if (searchQuery && !po.code.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => sortOrder === "newest" ? (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "") : (a.submittedAt ?? "").localeCompare(b.submittedAt ?? ""));
  const filteredStocktakes = stocktakes.filter((st) => stStatusFilter === "all" || st.status === stStatusFilter).sort((a, b) => b.businessDate.localeCompare(a.businessDate));

  // ── Supplier CRUD ──
  function openSupCreate() { setSupEditing(null); setSupForm({ name: "", contactName: "", email: "", phone: "", leadTimeDays: "2", minOrder: "" }); setSupOpen(true); }
  function openSupEdit(sup: Supplier) { setSupEditing(sup); setSupForm({ name: sup.name, contactName: sup.contactName ?? "", email: sup.email ?? "", phone: sup.phone ?? "", leadTimeDays: String(sup.leadTimeDays), minOrder: sup.minimumOrderCents ? String(sup.minimumOrderCents / 100) : "" }); setSupOpen(true); }
  async function saveSupplier() {
    if (!supForm.name.trim()) { toast.error("Name required"); return; }
    setBusy(true); try {
      const s: Supplier = { id: supEditing?.id ?? `sup-${Date.now()}`, venueId: "venue-1", name: supForm.name.trim(), contactName: supForm.contactName.trim() || undefined, email: supForm.email.trim() || undefined, phone: supForm.phone.trim() || undefined, leadTimeDays: parseInt(supForm.leadTimeDays) || 2, orderDays: [1, 2, 3, 4, 5], minimumOrderCents: supForm.minOrder ? Math.round(parseFloat(supForm.minOrder) * 100) : undefined, active: true };
      await purchasingService.saveSupplier(s); await refresh(); setSupOpen(false);
      toast.success(supEditing ? "Supplier updated" : "Supplier added");
    } catch { toast.error("Could not save supplier"); } finally { setBusy(false); }
  }

  // ── PO actions ──
  function openPO(supplierId: string) {
    setPoSupplierId(supplierId);
    const supplierCatalogue = supplierItems.filter((si) => si.supplierId === supplierId);
    setPoLines(supplierCatalogue.slice(0, 10).map((si) => ({ menuItemId: si.menuItemId, qty: "" })));
    setPoOpen(true);
  }

  async function savePO() {
    const active = poLines.filter((l) => parseInt(l.qty) > 0);
    if (active.length === 0) { toast.error("Add at least one item with quantity"); return; }
    setBusy(true); try {
      const ts = Date.now();
      const lines = active.map((l, i) => {
        const si = supplierItems.find((s) => s.menuItemId === l.menuItemId && s.supplierId === poSupplierId);
        const mi = items.find((it) => it.id === l.menuItemId);
        const qty = parseInt(l.qty);
        const unit = si?.unitCostCents ?? Math.round((mi?.price ?? 0) * 35);
        return { id: `pol-${ts}-${i}`, menuItemId: l.menuItemId, qtyOrdered: qty, qtyReceived: 0, unitCostCents: unit, lineTotalCents: qty * unit };
      });
      const subtotal = lines.reduce((s, l) => s + l.lineTotalCents, 0);
      const po: PurchaseOrder = {
        id: `po-${ts}`, venueId: "venue-1", supplierId: poSupplierId,
        code: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(ts % 1000).padStart(3, "0")}`,
        status: "draft", lines, subtotalCents: subtotal,
      };
      await purchasingService.savePurchaseOrder(po); await refresh(); setPoOpen(false);
      toast.success(`PO created with ${active.length} items`);
    } catch { toast.error("Could not create PO"); } finally { setBusy(false); }
  }

  async function submitPO(poId: string) {
    try { await purchasingService.submitPurchaseOrder(poId, meId); await refresh(); toast.success("PO submitted"); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not submit"); }
  }

  function openReceive(po: PurchaseOrder) {
    setReceivingPO(po);
    const qty: Record<string, number> = {};
    for (const l of po.lines) qty[l.id] = l.qtyOrdered - l.qtyReceived;
    setReceiveQty(qty);
    setReceiveOpen(true);
  }

  async function receivePO() {
    if (!receivingPO) return; setBusy(true); try {
      const lines = Object.entries(receiveQty).map(([lineId, qty]) => ({ lineId, qtyReceived: qty }));
      await purchasingService.receivePurchaseOrder(receivingPO.id, lines); await refresh(); setReceiveOpen(false);
      toast.success("PO received");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not receive"); } finally { setBusy(false); }
  }

  async function computeSuggestions(supplierId: string) {
    const openPos = orders.filter((po) => po.status !== "received" && po.status !== "cancelled");
    const s = suggestPurchaseOrder(items, openPos, (new Date().getDay() + 1) % 7, supplierItems, supplierId);
    setSuggestions(s); toast.success(`Found ${s.length} items below par`);
  }

  if (!ready) return <ListSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Purchasing" description="Suppliers, purchase orders, stocktakes and suggested ordering"
        actions={<Button size="sm" onClick={openSupCreate}><Plus className="size-4 mr-1" /> Add supplier</Button>}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search suppliers, PO codes…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={supFilter} onValueChange={setSupFilter}>
          <SelectTrigger className="w-40 h-9 text-sm"><SelectValue placeholder="All suppliers" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All suppliers</SelectItem>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={poStatusFilter} onValueChange={setPoStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="PO status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All POs</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="submitted">Submitted</SelectItem><SelectItem value="partially-received">Partial</SelectItem><SelectItem value="received">Received</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="w-32 h-9 text-sm"><ArrowUpDown className="size-3 mr-1" /></SelectTrigger>
          <SelectContent><SelectItem value="newest">Newest</SelectItem><SelectItem value="oldest">Oldest</SelectItem></SelectContent>
        </Select>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={Truck} title="No suppliers" description="Add your suppliers to start ordering." action={<Button onClick={openSupCreate}><Plus className="size-4 mr-1" /> Add supplier</Button>} />
      ) : filteredSuppliers.length === 0 ? (
        <EmptyState icon={Truck} title="No matching suppliers" description="Try clearing the filters." />
      ) : filteredSuppliers.map((sup) => (
        <Card key={sup.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sup.name}
                <Button variant="ghost" size="icon" className="size-6" onClick={() => openSupEdit(sup)}><Plus className="size-3 rotate-45" /></Button>
                {!sup.active && <Badge variant="outline">Inactive</Badge>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => computeSuggestions(sup.id)}><ShoppingCart className="size-4 mr-1" /> Par check</Button>
                <Button size="sm" variant="outline" onClick={() => openPO(sup.id)} disabled={busy}><Plus className="size-4 mr-1" /> New PO</Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">Lead: {sup.leadTimeDays}d · Min: {sup.minimumOrderCents ? formatMoney(sup.minimumOrderCents, "CAD") : "none"}{sup.contactName && ` · ${sup.contactName}`}{sup.email && ` · ${sup.email}`}</p>
            {filteredOrders.filter((po) => po.supplierId === sup.id).map((po) => (
              <div key={po.id} className="rounded-md border px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{po.code}</p>
                  <div className="flex items-center gap-1">
                    <Badge variant={STATUS_BADGE[po.status] ?? "outline"}>{po.status}</Badge>
                    {po.status === "draft" && (
                      <ConfirmDialog trigger={<Button size="sm" variant="outline">Submit</Button>} title={`Submit ${po.code}?`} description="The PO is sent to the supplier." confirmLabel="Submit" onConfirm={() => submitPO(po.id)} />
                    )}
                    {(po.status === "submitted" || po.status === "partially-received") && (
                      <Button size="sm" variant="outline" onClick={() => openReceive(po)}><Truck className="size-3 mr-1" /> Receive</Button>
                    )}
                  </div>
                </div>
                <div className="mt-1 space-y-0.5">{po.lines.map((l) => { const it = items.find((i) => i.id === l.menuItemId); return <div key={l.id} className="flex justify-between text-xs text-muted-foreground"><span>{it?.name ?? l.menuItemId}</span><span className="tabular-nums">{l.qtyReceived}/{l.qtyOrdered} × {formatMoney(l.unitCostCents, "CAD")}</span></div>; })}</div>
                <p className="mt-1 text-xs font-semibold tabular-nums">{formatMoney(po.subtotalCents, "CAD")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Stocktakes */}
      {stocktakes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Stocktakes
              <Select value={stStatusFilter} onValueChange={setStStatusFilter}>
                <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="Filter" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="counting">Counting</SelectItem><SelectItem value="committed">Committed</SelectItem></SelectContent>
              </Select>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredStocktakes.map((st) => (
              <div key={st.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div><p className="text-sm font-medium">{st.businessDate}</p><p className="text-xs text-muted-foreground">{st.scope} · {st.status}{st.committedAt && ` · ${new Date(st.committedAt).toLocaleTimeString()}`}</p></div>
                <div className="text-right"><p className={`text-sm font-semibold tabular-nums ${st.totalVarianceCents < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(st.totalVarianceCents, "CAD")}</p><p className="text-xs text-muted-foreground">{st.lines.length} lines</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base"><Package className="size-4 inline mr-1" />Suggested order</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">{suggestions.map((s) => <div key={s.menuItemId} className="flex justify-between rounded px-2 py-1 text-sm"><span>{s.itemName}</span><span className="tabular-nums">{s.suggestedQty} × {s.unitCostCents != null ? formatMoney(s.unitCostCents, "CAD") : "—"}</span></div>)}</div>
          </CardContent>
        </Card>
      )}

      {/* Supplier dialog */}
      <Dialog open={supOpen} onOpenChange={setSupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{supEditing ? "Edit supplier" : "Add supplier"}</DialogTitle><DialogDescription>Supplier contact and ordering defaults.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="s-name">Name *</Label><Input id="s-name" value={supForm.name} onChange={(e) => setSupForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="s-contact">Contact</Label><Input id="s-contact" value={supForm.contactName} onChange={(e) => setSupForm((p) => ({ ...p, contactName: e.target.value }))} /></div>
              <div><Label htmlFor="s-phone">Phone</Label><Input id="s-phone" value={supForm.phone} onChange={(e) => setSupForm((p) => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div><Label htmlFor="s-email">Email</Label><Input id="s-email" type="email" value={supForm.email} onChange={(e) => setSupForm((p) => ({ ...p, email: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="s-lead">Lead time (days)</Label><Input id="s-lead" type="number" min={1} value={supForm.leadTimeDays} onChange={(e) => setSupForm((p) => ({ ...p, leadTimeDays: e.target.value }))} /></div>
              <div><Label htmlFor="s-min">Min order ($)</Label><Input id="s-min" placeholder="500" value={supForm.minOrder} onChange={(e) => setSupForm((p) => ({ ...p, minOrder: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSupOpen(false)}>Cancel</Button>
            <Button onClick={saveSupplier} disabled={!supForm.name.trim() || busy}>{supEditing ? "Save" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive PO dialog */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Receive goods</DialogTitle><DialogDescription>{receivingPO?.code} from {suppliers.find((s) => s.id === receivingPO?.supplierId)?.name}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            {receivingPO?.lines.map((l) => {
              const it = items.find((i) => i.id === l.menuItemId);
              return (
                <div key={l.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">{it?.name ?? l.menuItemId} <span className="text-xs text-muted-foreground">({l.qtyReceived}/{l.qtyOrdered})</span></span>
                  <Input type="number" min={0} max={l.qtyOrdered - l.qtyReceived} value={receiveQty[l.id] ?? 0} onChange={(e) => setReceiveQty((prev) => ({ ...prev, [l.id]: parseInt(e.target.value) || 0 }))} className="w-20 text-sm" />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button onClick={receivePO} disabled={busy}>Confirm receipt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create PO dialog */}
      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
            <DialogDescription>
              {suppliers.find((s) => s.id === poSupplierId)?.name} — select items and quantities
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {(() => {
              const supplierCatalogue = supplierItems.filter((si) => si.supplierId === poSupplierId);
              const allItemIds = new Set(supplierCatalogue.map((si) => si.menuItemId));
              // Show catalogue items first, then other menu items for convenience
              const ordered = [...supplierCatalogue.map((si) => si.menuItemId), ...items.filter((i) => !allItemIds.has(i.id)).map((i) => i.id)];
              const seen = new Set<string>();
              return ordered.map((itemId) => {
                if (seen.has(itemId)) return null; seen.add(itemId);
                const mi = items.find((i) => i.id === itemId);
                if (!mi) return null;
                const si = supplierCatalogue.find((s) => s.menuItemId === itemId);
                const line = poLines.find((l) => l.menuItemId === itemId);
                const qty = line ? parseInt(line.qty) || 0 : 0;
                const isInCatalogue = !!si;
                return (
                  <div key={itemId} className={`flex items-center gap-3 rounded-md border px-3 py-2 ${qty > 0 ? "border-primary/40 bg-primary/5" : isInCatalogue ? "" : "opacity-60"}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{mi.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {isInCatalogue ? `${formatMoney(si?.unitCostCents ?? 0, "CAD")}/unit` : "Not in catalogue"}
                        {si?.supplierSku && ` · SKU: ${si.supplierSku}`}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={line?.qty ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPoLines((prev) => {
                          const exists = prev.find((l) => l.menuItemId === itemId);
                          if (exists) return prev.map((l) => l.menuItemId === itemId ? { ...l, qty: val } : l);
                          return [...prev, { menuItemId: itemId, qty: val }];
                        });
                      }}
                      className="w-20 text-sm shrink-0"
                    />
                  </div>
                );
              });
            })()}
          </div>
          <div className="text-xs text-muted-foreground text-right">
            {(() => {
              const active = poLines.filter((l) => parseInt(l.qty) > 0);
              if (active.length === 0) return "No items selected";
              const total = active.reduce((s, l) => {
                const si = supplierItems.find((si) => si.menuItemId === l.menuItemId && si.supplierId === poSupplierId);
                const mi = items.find((i) => i.id === l.menuItemId);
                return s + parseInt(l.qty) * (si?.unitCostCents ?? Math.round((mi?.price ?? 0) * 35));
              }, 0);
              return `${active.length} items · subtotal ${formatMoney(total, "CAD")}`;
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoOpen(false)}>Cancel</Button>
            <Button onClick={savePO} disabled={busy}>Create PO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
