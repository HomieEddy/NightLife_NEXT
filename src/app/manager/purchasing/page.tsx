"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, BookOpen, Package, Loader2, Plus, Pencil, Search, ShoppingCart, Trash2, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { purchasingService } from "@/features/platform/purchasing-service";
import { menuService } from "@/features/menu/services";
import { staffService } from "@/features/workforce/staff-service";
import { suggestPurchaseOrder } from "@/features/ordering/costs";
import { formatMoney } from "@/features/shared/format";
import { zSupplierInput, zSupplierCatalogueInput } from "@/lib/form-schemas";
import { useAuth } from "@/context/auth-context";
import { purchasingKeys } from "@/features/platform/query-keys";
import { menuKeys } from "@/features/menu/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import type { PurchaseOrder, Stocktake, Supplier, SupplierItem, MenuItem } from "@/lib/types";

const STATUS_BADGE: Record<string, "default" | "secondary" | "outline"> = { draft: "outline", submitted: "secondary", "partially-received": "secondary", received: "default", cancelled: "outline" };

export default function ManagerPurchasingPage() {
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const t = useTranslations("manager.purchasing");

  const [suggestions, setSuggestions] = useState<{ menuItemId: string; itemName: string; suggestedQty: number; unitCostCents: number | null }[]>([]);
  const [nonFormBusy, setNonFormBusy] = useState(false);

  // Filters
  const [supFilter, setSupFilter] = useState<string>("all");
  const [poStatusFilter, setPoStatusFilter] = useState<string>("all");
  const [stStatusFilter, setStStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("newest");

  // Supplier dialog
  const [supOpen, setSupOpen] = useState(false);
  const [supEditing, setSupEditing] = useState<Supplier | null>(null);

  const supplierForm = useForm({
    resolver: zodResolver(zSupplierInput),
    defaultValues: { name: "", contactName: "", email: "", phone: "", leadTimeDays: 2, minOrder: 0 },
  });

  const supBusy = supplierForm.formState.isSubmitting;

  // PO create dialog
  const [poOpen, setPoOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState("");
  const [poLines, setPoLines] = useState<{ menuItemId: string; qty: string }[]>([]);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});

  // Catalogue management dialog
  const [catOpen, setCatOpen] = useState(false);
  const [catSupplierId, setCatSupplierId] = useState("");
  const [catEditing, setCatEditing] = useState<SupplierItem | null>(null);

  const catForm = useForm({
    resolver: zodResolver(zSupplierCatalogueInput),
    defaultValues: { menuItemId: "", unitCostCents: 0, supplierSku: "", preferred: false },
  });

  const catBusy = catForm.formState.isSubmitting;

  const zStocktakeForm = z.object({
    date: z.string().min(1, t("dateRequired")),
  });

  const stocktakeForm = useForm({
    resolver: zodResolver(zStocktakeForm),
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  });

  const [stOpen, setStOpen] = useState(false);

  const { data: suppliers = [], isPending: loading } = useQuery({
    queryKey: purchasingKeys.suppliers(venueId),
    queryFn: () => purchasingService.listSuppliers(),
    enabled: !!venueId,
  });

  const { data: orders = [] } = useQuery({
    queryKey: purchasingKeys.purchaseOrders(venueId),
    queryFn: () => purchasingService.listPurchaseOrders(),
    enabled: !!venueId,
  });

  const { data: items = [] } = useQuery({
    queryKey: menuKeys.items(venueId),
    queryFn: () => menuService.listItems(),
    enabled: !!venueId,
  });

  const { data: supplierItems = [] } = useQuery({
    queryKey: purchasingKeys.supplierItems(venueId),
    queryFn: () => purchasingService.listSupplierItems(),
    enabled: !!venueId,
  });

  const { data: stocktakes = [] } = useQuery({
    queryKey: purchasingKeys.stocktakes(venueId),
    queryFn: () => purchasingService.listStocktakes(),
    enabled: !!venueId,
  });

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const ready = !!venueId && !loading;
  const meId = me?.id ?? "";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: purchasingKeys.suppliers(venueId) });
    queryClient.invalidateQueries({ queryKey: purchasingKeys.purchaseOrders(venueId) });
    queryClient.invalidateQueries({ queryKey: purchasingKeys.supplierItems(venueId) });
    queryClient.invalidateQueries({ queryKey: purchasingKeys.stocktakes(venueId) });
    queryClient.invalidateQueries({ queryKey: menuKeys.items(venueId) });
  };

  // Supplier mutations
  const saveSupplierMutation = useMutation({
    mutationFn: async (data: z.infer<typeof zSupplierInput>) => {
      const s: Supplier = {
        id: supEditing?.id ?? `sup-${Date.now()}`,
        venueId: venueId,
        name: data.name.trim(),
        contactName: data.contactName.trim() || undefined,
        email: data.email?.trim() || undefined,
        phone: data.phone.trim() || undefined,
        leadTimeDays: data.leadTimeDays || 2,
        orderDays: [1, 2, 3, 4, 5],
        minimumOrderCents: data.minOrder ? Math.round(data.minOrder * 100) : undefined,
        active: true,
      };
      return purchasingService.saveSupplier(s);
    },
    onSuccess: () => {
      toast.success(supEditing ? t("toastSupplierUpdated") : t("toastSupplierAdded"));
      setSupOpen(false);
      invalidate();
    },
    onError: () => toast.error(t("toastCouldNotSaveSupplier")),
  });

  // Stocktake mutations
  const startStocktakeMutation = useMutation({
    mutationFn: async (data: { date: string }) => {
      const st: Stocktake = {
        id: `st-${data.date}`,
        venueId: venueId,
        businessDate: data.date,
        scope: "full",
        status: "open",
        startedAt: new Date().toISOString(),
        startedByStaffId: meId,
        lines: items.map((item) => ({
          id: `stl-${data.date}-${item.id}`,
          menuItemId: item.id,
          expectedQty: item.inventory,
          countedQty: item.inventory,
          varianceQty: 0,
          varianceCents: 0,
        })),
        totalVarianceCents: 0,
      };
      return purchasingService.saveStocktake(st);
    },
    onSuccess: (_, data) => {
      toast.success(t("toastStocktakeStarted", { date: data.date }));
      invalidate();
    },
    onError: () => toast.error(t("toastCouldNotStartStocktake")),
  });

  const commitStocktakeMutation = useMutation({
    mutationFn: (st: Stocktake) => purchasingService.commitStocktake(st.id),
    onSuccess: () => {
      toast.success(t("toastStocktakeCommitted"));
      invalidate();
    },
    onError: () => toast.error(t("toastCouldNotCommit")),
  });

  // PO mutations
  const savePOMutation = useMutation({
    mutationFn: async () => {
      const active = poLines.filter((l) => parseInt(l.qty) > 0);
      if (active.length === 0) throw new Error(t("addAtLeastOneItem"));
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
        id: `po-${ts}`, venueId: venueId, supplierId: poSupplierId,
        code: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(ts % 1000).padStart(3, "0")}`,
        status: "draft", lines, subtotalCents: subtotal,
      };
      return purchasingService.savePurchaseOrder(po);
    },
    onSuccess: (_, __, context) => {
      const active = poLines.filter((l) => parseInt(l.qty) > 0);
      toast.success(t("toastPoCreated", { count: active.length }));
      setPoOpen(false);
      invalidate();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === t("addAtLeastOneItem")) {
        toast.error(error.message);
      } else {
        toast.error(t("toastCouldNotCreatePo"));
      }
    },
  });

  const submitPOMutation = useMutation({
    mutationFn: (poId: string) => purchasingService.submitPurchaseOrder(poId, meId),
    onSuccess: () => { invalidate(); toast.success(t("toastPoSubmitted")); },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("toastCouldNotSubmit")),
  });

  const receivePOMutation = useMutation({
    mutationFn: async () => {
      if (!receivingPO) throw new Error("No PO selected");
      const lines = Object.entries(receiveQty).map(([lineId, qty]) => ({ lineId, qtyReceived: qty }));
      return purchasingService.receivePurchaseOrder(receivingPO.id, lines);
    },
    onSuccess: () => {
      setReceiveOpen(false);
      toast.success(t("toastPoReceived"));
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t("toastCouldNotReceive")),
  });

  // Catalogue mutations
  const saveCatalogueItemMutation = useMutation({
    mutationFn: async (data: z.infer<typeof zSupplierCatalogueInput>) => {
      const si: SupplierItem = {
        id: catEditing?.id ?? `si-${catSupplierId}-${data.menuItemId}`,
        supplierId: catSupplierId,
        menuItemId: data.menuItemId,
        unitCostCents: data.unitCostCents || undefined,
        caseSize: undefined,
        caseCostCents: undefined,
        supplierSku: data.supplierSku.trim() || undefined,
        preferred: data.preferred,
      };
      return purchasingService.saveSupplierItem(si);
    },
    onSuccess: () => {
      setCatEditing(null);
      catForm.reset({ menuItemId: "", unitCostCents: 0, supplierSku: "", preferred: false });
      toast.success(catEditing ? t("toastCatalogueItemUpdated") : t("toastItemAddedToCatalogue"));
      invalidate();
    },
    onError: () => toast.error(t("toastCouldNotSaveCatalogueItem")),
  });

  const removeCatalogueItemMutation = useMutation({
    mutationFn: (siId: string) => purchasingService.removeSupplierItem(siId),
    onSuccess: () => { invalidate(); toast.success(t("toastRemovedFromCatalogue")); },
    onError: () => toast.error(t("toastCouldNotRemove")),
  });

  const onStartStocktake = stocktakeForm.handleSubmit(async (data) => {
    startStocktakeMutation.mutate(data);
  });

  async function commitStocktake(st: Stocktake) {
    commitStocktakeMutation.mutate(st);
  }

  // Status label maps
  const poStatusLabel: Record<string, string> = {
    draft: t("statusDraft"),
    submitted: t("statusSubmitted"),
    "partially-received": t("statusPartiallyReceived"),
    received: t("statusReceived"),
    cancelled: t("statusCancelled"),
  };
  const stStatusLabel: Record<string, string> = {
    open: t("stocktakeStatusOpen"),
    counting: t("stocktakeStatusCounting"),
    committed: t("stocktakeStatusCommitted"),
  };
  const stScopeLabel: Record<string, string> = {
    full: t("stocktakeScopeFull"),
  };

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
  function openSupCreate() { setSupEditing(null); supplierForm.reset({ name: "", contactName: "", email: "", phone: "", leadTimeDays: 2, minOrder: 0 }); setSupOpen(true); }
  function openSupEdit(sup: Supplier) { setSupEditing(sup); supplierForm.reset({ name: sup.name, contactName: sup.contactName ?? "", email: sup.email ?? "", phone: sup.phone ?? "", leadTimeDays: sup.leadTimeDays, minOrder: sup.minimumOrderCents ? sup.minimumOrderCents / 100 : 0 }); setSupOpen(true); }

  const onSaveSupplier = supplierForm.handleSubmit(async (data) => {
    saveSupplierMutation.mutate(data);
  });

  // ── PO actions ──
  function openPO(supplierId: string) {
    setPoSupplierId(supplierId);
    const catalogue = supplierItems.filter((si) => si.supplierId === supplierId);
    setPoLines(catalogue.slice(0, 10).map((si) => ({ menuItemId: si.menuItemId, qty: "" })));
    setPoOpen(true);
  }

  function savePO() {
    const active = poLines.filter((l) => parseInt(l.qty) > 0);
    if (active.length === 0) { toast.error(t("addAtLeastOneItem")); return; }
    savePOMutation.mutate();
  }

  function submitPO(poId: string) {
    submitPOMutation.mutate(poId);
  }

  function openReceive(po: PurchaseOrder) {
    setReceivingPO(po);
    const qty: Record<string, number> = {};
    for (const l of po.lines) qty[l.id] = l.qtyOrdered - l.qtyReceived;
    setReceiveQty(qty);
    setReceiveOpen(true);
  }

  function receivePO() {
    receivePOMutation.mutate();
  }

  function computeSuggestions(supplierId: string) {
    const openPos = orders.filter((po) => po.status !== "received" && po.status !== "cancelled");
    const s = suggestPurchaseOrder(items, openPos, (new Date().getDay() + 1) % 7, supplierItems, supplierId);
    setSuggestions(s);
    toast.success(t("toastFoundItemsBelowPar", { count: s.length }));
  }

  // ── Catalogue management ──
  function openCatalogue(supplierId: string) { setCatSupplierId(supplierId); setCatEditing(null); catForm.reset({ menuItemId: "", unitCostCents: 0, supplierSku: "", preferred: false }); setCatOpen(true); }

  function editCatalogueItem(si: SupplierItem) {
    setCatEditing(si);
    catForm.reset({ menuItemId: si.menuItemId, unitCostCents: si.unitCostCents ?? 0, supplierSku: si.supplierSku ?? "", preferred: si.preferred });
    setCatOpen(true);
  }

  function addNewCatalogueItem() {
    setCatEditing(null);
    catForm.reset({ menuItemId: "", unitCostCents: 0, supplierSku: "", preferred: false });
  }

  const onSaveCatalogueItem = catForm.handleSubmit(async (data) => {
    saveCatalogueItemMutation.mutate(data);
  });

  function removeFromCatalogue(siId: string) {
    removeCatalogueItemMutation.mutate(siId);
  }

  if (!ready) return <ListSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}
        breadcrumbs={[{ label: t("breadcrumbCatalogue"), href: "/manager/menu" }, { label: t("breadcrumbPurchasing") }]}
        actions={<Button size="sm" onClick={openSupCreate}><Plus className="size-4 mr-1" /> {t("addSupplier")}</Button>}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={supFilter} onValueChange={setSupFilter}>
          <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder={t("allSuppliers")} /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("allSuppliers")}</SelectItem>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={poStatusFilter} onValueChange={setPoStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder={t("poStatus")} /></SelectTrigger>
          <SelectContent><SelectItem value="all">{t("allPos")}</SelectItem><SelectItem value="draft">{t("statusDraft")}</SelectItem><SelectItem value="submitted">{t("statusSubmitted")}</SelectItem><SelectItem value="partially-received">{t("statusPartiallyReceived")}</SelectItem><SelectItem value="received">{t("statusReceived")}</SelectItem><SelectItem value="cancelled">{t("statusCancelled")}</SelectItem></SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="h-9 w-32 text-sm"><ArrowUpDown className="size-3 mr-1" /></SelectTrigger>
          <SelectContent><SelectItem value="newest">{t("sortNewest")}</SelectItem><SelectItem value="oldest">{t("sortOldest")}</SelectItem></SelectContent>
        </Select>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState icon={Truck} title={t("emptyNoSuppliers")} description={t("emptyNoSuppliersDesc")} action={<Button onClick={openSupCreate}><Plus className="size-4 mr-1" /> {t("addSupplier")}</Button>} />
      ) : filteredSuppliers.length === 0 ? (
        <EmptyState icon={Truck} title={t("emptyNoMatchingSuppliers")} description={t("emptyNoMatchingSuppliersDesc")} />
      ) : filteredSuppliers.map((sup) => (
        <Card key={sup.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                {sup.name}
                <Button variant="ghost" size="icon" className="size-6" aria-label={t("ariaEditSupplier")} onClick={() => openSupEdit(sup)}><Plus className="size-3 rotate-45" /></Button>
                {!sup.active && <Badge variant="outline">{t("inactive")}</Badge>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => openCatalogue(sup.id)}><BookOpen className="size-4 mr-1" /> {t("catalogueBtn")}</Button>
                <Button size="sm" variant="outline" onClick={() => computeSuggestions(sup.id)}><ShoppingCart className="size-4 mr-1" /> {t("parCheck")}</Button>
                <Button size="sm" variant="outline" onClick={() => openPO(sup.id)} disabled={nonFormBusy}><Plus className="size-4 mr-1" /> {t("newPo")}</Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("leadMin", { leadDays: sup.leadTimeDays, minAmount: sup.minimumOrderCents ? formatMoney(sup.minimumOrderCents, "CAD") : t("none") })}{sup.contactName && ` · ${sup.contactName}`}{sup.email && ` · ${sup.email}`}</p>
            {filteredOrders.filter((po) => po.supplierId === sup.id).map((po) => (
              <div key={po.id} className="rounded-md border px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{po.code}</p>
                  <div className="flex items-center gap-1">
                    <Badge variant={STATUS_BADGE[po.status] ?? "outline"}>{poStatusLabel[po.status] ?? po.status}</Badge>
                    {po.status === "draft" && (
                      <ConfirmDialog trigger={<Button size="sm" variant="outline">{t("submit")}</Button>} title={t("submitPoTitle", { code: po.code })} description={t("submitPoDesc")} confirmLabel={t("submit")} onConfirm={() => submitPO(po.id)} />
                    )}
                    {(po.status === "submitted" || po.status === "partially-received") && (
                      <Button size="sm" variant="outline" onClick={() => openReceive(po)}><Truck className="size-3 mr-1" /> {t("receive")}</Button>
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            {t("stocktakes")}
            <div className="flex items-center gap-2">
              <Select value={stStatusFilter} onValueChange={setStStatusFilter}>
                <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder={t("stocktakeFilter")} /></SelectTrigger>
                <SelectContent><SelectItem value="all">{t("stocktakeFilterAll")}</SelectItem><SelectItem value="open">{t("stocktakeStatusOpen")}</SelectItem><SelectItem value="counting">{t("stocktakeStatusCounting")}</SelectItem><SelectItem value="committed">{t("stocktakeStatusCommitted")}</SelectItem></SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => { stocktakeForm.reset({ date: new Date().toISOString().slice(0, 10) }); setStOpen(true); }}>
                <Plus className="size-3.5 mr-1" /> {t("newStocktake")}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredStocktakes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noStocktakes")}</p>
          ) : (
            filteredStocktakes.map((st) => (
              <div key={st.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <div><p className="text-sm font-medium">{st.businessDate}</p><p className="text-xs text-muted-foreground">{stScopeLabel[st.scope] ?? st.scope} · {stStatusLabel[st.status] ?? st.status}{st.committedAt && ` · ${new Date(st.committedAt).toLocaleTimeString()}`}</p></div>
                <div className="flex items-center gap-2 text-right">
                  <div><p className={`text-sm font-semibold tabular-nums ${st.totalVarianceCents < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatMoney(st.totalVarianceCents, "CAD")}</p><p className="text-xs text-muted-foreground">{t("linesCount", { count: st.lines.length })}</p></div>
                  {st.status !== "committed" && (
                    <ConfirmDialog
                      trigger={<Button size="sm" disabled={nonFormBusy || commitStocktakeMutation.isPending}>{t("commitBtn")}</Button>}
                      title={t("commitTitle")}
                      description={t("commitDesc")}
                      confirmLabel={t("commitConfirm")}
                      onConfirm={() => commitStocktake(st)}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base"><Package className="size-4 inline mr-1" />{t("suggestedOrder")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">{suggestions.map((s) => <div key={s.menuItemId} className="flex justify-between rounded px-2 py-1 text-sm"><span>{s.itemName}</span><span className="tabular-nums">{s.suggestedQty} × {s.unitCostCents != null ? formatMoney(s.unitCostCents, "CAD") : "—"}</span></div>)}</div>
          </CardContent>
        </Card>
      )}

      {/* Supplier dialog */}
      <Dialog open={supOpen} onOpenChange={setSupOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{supEditing ? t("dialogEditSupplier") : t("dialogAddSupplier")}</DialogTitle><DialogDescription>{t("supplierDialogDesc")}</DialogDescription></DialogHeader>
          <form onSubmit={onSaveSupplier} className="space-y-3">
            <div><Label htmlFor="s-name">{t("nameRequired")}</Label><Input id="s-name" {...supplierForm.register("name")} />{supplierForm.formState.errors.name && <p className="text-xs text-destructive">{supplierForm.formState.errors.name.message}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="s-contact">{t("contact")}</Label><Input id="s-contact" {...supplierForm.register("contactName")} /></div>
              <div><Label htmlFor="s-phone">{t("phone")}</Label><Input id="s-phone" {...supplierForm.register("phone")} /></div>
            </div>
            <div><Label htmlFor="s-email">{t("email")}</Label><Input id="s-email" type="email" {...supplierForm.register("email")} />{supplierForm.formState.errors.email && <p className="text-xs text-destructive">{supplierForm.formState.errors.email.message}</p>}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="s-lead">{t("leadTimeDays")}</Label><Input id="s-lead" type="number" min={1} {...supplierForm.register("leadTimeDays", { valueAsNumber: true })} /></div>
              <div><Label htmlFor="s-min">{t("minOrderDollars")}</Label><Input id="s-min" placeholder="500" {...supplierForm.register("minOrder", { valueAsNumber: true })} /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSupOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={supBusy}>{supEditing ? t("save") : t("add")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive PO dialog */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("receiveGoods")}</DialogTitle><DialogDescription>{t("receiveFrom", { code: receivingPO?.code ?? "", supplier: suppliers.find((s) => s.id === receivingPO?.supplierId)?.name ?? "" })}</DialogDescription></DialogHeader>
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
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>{t("cancel")}</Button>
            <Button onClick={receivePO} disabled={receivePOMutation.isPending}>{t("confirmReceipt")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create PO dialog */}
      <Dialog open={poOpen} onOpenChange={setPoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("newPoTitle")}</DialogTitle>
            <DialogDescription>
              {t("newPoDesc", { supplier: suppliers.find((s) => s.id === poSupplierId)?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {(() => {
              const supplierCatalogue = supplierItems.filter((si) => si.supplierId === poSupplierId);
              const allItemIds = new Set(supplierCatalogue.map((si) => si.menuItemId));
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
                        {isInCatalogue ? `${formatMoney(si?.unitCostCents ?? 0, "CAD")}/unit` : t("notInCatalogue")}
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
              if (active.length === 0) return t("noItemsSelected");
              const total = active.reduce((s, l) => {
                const si = supplierItems.find((si) => si.menuItemId === l.menuItemId && si.supplierId === poSupplierId);
                const mi = items.find((i) => i.id === l.menuItemId);
                return s + parseInt(l.qty) * (si?.unitCostCents ?? Math.round((mi?.price ?? 0) * 35));
              }, 0);
              return t("itemsSubtotal", { count: active.length, total: formatMoney(total, "CAD") });
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPoOpen(false)}>{t("cancel")}</Button>
            <Button onClick={savePO} disabled={savePOMutation.isPending}>{t("createPo")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Catalogue management dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("catalogueTitle", { supplier: suppliers.find((s) => s.id === catSupplierId)?.name ?? "" })}</DialogTitle>
            <DialogDescription>{catEditing ? t("dialogEditCatalogueEntry") : t("catalogueDesc")}</DialogDescription>
          </DialogHeader>

          {/* Add/edit form */}
          <form onSubmit={onSaveCatalogueItem} className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs">{t("itemLabel")}</Label>
                <Select value={catForm.watch("menuItemId")} onValueChange={(v) => catForm.setValue("menuItemId", v)}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder={t("selectMenuItem")} /></SelectTrigger>
                  <SelectContent>
                    {items.filter((i) => catEditing || !supplierItems.some((si) => si.supplierId === catSupplierId && si.menuItemId === i.id)).map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {catForm.formState.errors.menuItemId && <p className="text-xs text-destructive">{catForm.formState.errors.menuItemId.message}</p>}
              </div>
              <div className="w-24">
                <Label className="text-xs">{t("unitCost")}</Label>
                <Input className="mt-1 h-8 text-sm" type="number" step={0.01} value={catForm.watch("unitCostCents") ? (catForm.watch("unitCostCents") / 100).toString() : ""} onChange={(e) => catForm.setValue("unitCostCents", Math.round(parseFloat(e.target.value) * 100) || 0, { shouldValidate: true })} placeholder="4.00" />
                {catForm.formState.errors.unitCostCents && <p className="text-xs text-destructive">{catForm.formState.errors.unitCostCents.message}</p>}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1"><Label className="text-xs">{t("sku")}</Label><Input className="mt-1 h-8 text-sm" {...catForm.register("supplierSku")} placeholder="GG-750" /></div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Switch checked={catForm.watch("preferred")} onCheckedChange={(v) => catForm.setValue("preferred", v)} id="cat-preferred" />
              <Label htmlFor="cat-preferred">{t("preferredSupplier")}</Label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!catForm.watch("menuItemId") || catBusy}>{catEditing ? t("update") : t("addToCatalogue")}</Button>
              {catEditing && <Button type="button" size="sm" variant="ghost" onClick={addNewCatalogueItem}>{t("cancelEdit")}</Button>}
            </div>
          </form>

          {/* Existing catalogue items */}
          <div className="max-h-60 space-y-1 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {t("itemsInCatalogue", { count: supplierItems.filter((si) => si.supplierId === catSupplierId).length })}
            </p>
            {supplierItems.filter((si) => si.supplierId === catSupplierId).map((si) => {
              const mi = items.find((i) => i.id === si.menuItemId);
              return (
                <div key={si.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{mi?.name ?? si.menuItemId}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMoney(si.unitCostCents ?? 0, "CAD")}/unit
                      {si.supplierSku && ` · ${si.supplierSku}`}
                      {si.caseSize && ` · case of ${si.caseSize}`}
                      {si.preferred && <Badge variant="secondary" className="ml-1 text-[10px]">{t("preferred")}</Badge>}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={t("ariaEditCatalogue")} onClick={() => editCatalogueItem(si)}><Pencil className="size-3" /></Button>
                  <ConfirmDialog trigger={<Button variant="ghost" size="icon" className="size-7 shrink-0 text-destructive" aria-label={t("ariaRemoveFromCatalogue")}><Trash2 className="size-3" /></Button>} title={t("removeFromCatalogueTitle")} description={t("removeFromCatalogueDesc", { item: mi?.name ?? si.menuItemId })} confirmLabel={t("remove")} destructive onConfirm={() => removeFromCatalogue(si.id)} />
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>{t("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stocktake create dialog */}
      <Dialog open={stOpen} onOpenChange={setStOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("startStocktake")}</DialogTitle>
            <DialogDescription>
              {t("stocktakeDesc", { count: items.length })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onStartStocktake} className="space-y-3">
            <div><Label htmlFor="st-date">{t("businessDate")}</Label><Input id="st-date" type="date" {...stocktakeForm.register("date")} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={nonFormBusy || startStocktakeMutation.isPending || stocktakeForm.formState.isSubmitting}>
                {(startStocktakeMutation.isPending || stocktakeForm.formState.isSubmitting) ? t("starting") : t("startStocktakeBtn")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
