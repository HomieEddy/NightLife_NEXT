"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Pencil, Plus, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityChip } from "@/components/shared/entity-chip";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { TableCard } from "@/components/shared/table-card";
import { venueService } from "@/features/venue/services";
import { venueKeys } from "@/features/venue/query-keys";
import { SearchInput } from "@/components/shared/search-input";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { useHighlight } from "@/lib/use-highlight";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/features/shared/utils";
import { z } from "zod";
import type { TableStatus, VenueTable } from "@/lib/types";

const STATUSES: TableStatus[] = ["open", "occupied", "reserved", "closed"];

function TablesContent() {
  const t = useTranslations("manager.tables");
  const ts = useTranslations("shared");

  const zTableForm = z.object({
    code: z.string().min(1, t("codeRequired")),
    label: z.string().min(1, t("labelRequired")),
    zoneId: z.string().min(1, t("zoneRequired")),
    seats: z.number().int().min(1),
    minimumSpend: z.string(),
  });

  type FormValues = z.infer<typeof zTableForm>;
  const EMPTY_VALUES: FormValues = { code: "", label: "", zoneId: "", seats: 4, minimumSpend: "" };

  const searchParams = useSearchParams();
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [zoneFilter, setZoneFilter] = useState(searchParams.get("zone") ?? "all");
  const [statusFilter, setStatusFilter] = useState<TableStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const highlighted = useHighlight();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(zTableForm),
    defaultValues: EMPTY_VALUES,
  });
  const zoneId = watch("zoneId");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: venueKeys.tables(venueId) });
  };

  const { data: zones = [] } = useQuery({
    queryKey: venueKeys.zones(venueId),
    queryFn: () => venueService.listZones(),
    enabled: !!venueId,
  });

  const { data: tables } = useQuery({
    queryKey: venueKeys.tables(venueId),
    queryFn: () => venueService.listTables(),
    enabled: !!venueId,
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ table, status }: { table: VenueTable; status: TableStatus }) =>
      venueService.setTableStatus(table.id, status),
    onSuccess: (_, { table, status }) => {
      toast.success(`${table.code} → ${status}`);
      invalidate();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const input = {
        code: data.code.trim().toUpperCase(),
        label: data.label.trim(),
        zoneId: data.zoneId,
        seats: Math.max(1, data.seats),
        minimumSpend: data.minimumSpend === "" ? null : Math.max(0, Number(data.minimumSpend)),
      };
      if (editingId) {
        await venueService.updateTable(editingId, input);
      } else {
        await venueService.createTable({ ...input, status: "open" });
      }
    },
    onSuccess: () => {
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("saveFailed")),
  });

  const removeMutation = useMutation({
    mutationFn: (table: VenueTable) => venueService.deleteTable(table.id),
    onSuccess: (_, table) => {
      toast.info(`${table.code} deleted`);
      invalidate();
    },
  });

  function openCreate() {
    setEditingId(null);
    reset({ ...EMPTY_VALUES, zoneId: zoneFilter !== "all" ? zoneFilter : zones[0]?.id ?? "" });
    setDialogOpen(true);
  }

  function openEdit(table: VenueTable) {
    setEditingId(table.id);
    reset({
      code: table.code,
      label: table.label,
      zoneId: table.zoneId,
      seats: table.seats,
      minimumSpend: table.minimumSpend === null ? "" : String(table.minimumSpend),
    });
    setDialogOpen(true);
  }

  const visible = (tables ?? []).filter((t) => {
    if (zoneFilter !== "all" && t.zoneId !== zoneFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const haystack = [t.code, t.label, zoneName(t.zoneId) ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name;

  const { sliced, hasMore, loadMore, reset: resetSlice } = useInfiniteSlice(visible, 10);

  useEffect(() => { resetSlice(); }, [query, zoneFilter, statusFilter, resetSlice]);

  const zoneChips = (tableZoneId: string) => {
    const name = zoneName(tableZoneId);
    if (!name) return undefined;
    return (
      <span className="inline-flex gap-1.5">
        <EntityChip type="zone" id={tableZoneId} label={name} />
        <EntityChip type="zone-staff" id={tableZoneId} label={t("staff")} />
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-44">
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
            <Button onClick={openCreate}>
              <Plus className="size-4" /> {t("newTableTitle")}
            </Button>
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
          {(["all", ...STATUSES] as const).map((s) => (
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

      {tables === undefined ? (
        <ListSkeleton rows={6} rowHeight="h-28" />
      ) : visible.length === 0 ? (
        <EmptyState icon={Table2} title={t("noTablesMatch")} description={t("noTablesDesc")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sliced.map((table) => (
            <div key={table.id} id={`highlight-${table.id}`}>
              <TableCard
                table={table}
                className={cn(
                  "transition-shadow",
                  highlighted === table.id && "ring-2 ring-primary shadow-lg",
                )}
                zoneName={zoneChips(table.zoneId)}
                footer={
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {STATUSES.map((status) => (
                        <ConfirmDialog
                          key={status}
                          trigger={
                            <button
                              type="button"
                              disabled={table.status === status}
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
                                table.status === status
                                  ? "border-primary bg-primary/15 text-primary"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {status}
                            </button>
                          }
                          title={`${ts("set")} ${table.code} → ${status}?`}
                          description={t("statusDesc")}
                          confirmLabel={`${ts("set")} ${status}`}
                          onConfirm={() => setStatusMutation.mutate({ table, status })}
                        />
                      ))}
                    </div>
                    <div className="flex shrink-0 items-center">
                      <TooltipIconButton variant="ghost" className="size-7" tooltip={t("editTable")} onClick={() => openEdit(table)}>
                        <Pencil className="size-3.5" />
                      </TooltipIconButton>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-600 dark:hover:text-red-400" aria-label={t("deleteTable")}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        }
                        title={t("deleteTable") + " " + table.code + "?"}
                        description={t("deleteDesc")}
                        confirmLabel={t("deleteConfirm")}
                        destructive
                        onConfirm={() => removeMutation.mutate(table)}
                      />
                    </div>
                  </div>
                }
              />
            </div>
          ))}
        </div>
      )}

      <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? t("editTableTitle") : t("newTableTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="table-code">{t("code")}</Label>
                <Input id="table-code" placeholder={t("codePlaceholder")} {...register("code")} />
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="table-label">{t("label")}</Label>
                <Input id="table-label" placeholder={t("labelPlaceholder")} {...register("label")} />
                {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("zone")}</Label>
              <Select value={zoneId} onValueChange={(v) => setValue("zoneId", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("zonePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.zoneId && <p className="text-xs text-destructive">{errors.zoneId.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="table-seats">{t("seats")}</Label>
                <Input id="table-seats" type="number" min={1} {...register("seats", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="table-min">{t("minimumSpend")}</Label>
                <Input id="table-min" type="number" min={0} step={50} placeholder={t("minimumSpendPlaceholder")} {...register("minimumSpend")} />
              </div>
            </div>
            {!editingId && (
              <p className="text-xs text-muted-foreground">
                {t("qrCodeHint")}
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setDialogOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {saveMutation.isPending ? t("saving") : editingId ? t("save") : t("createTable")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ManagerTablesPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={6} rowHeight="h-28" />}>
      <TablesContent />
    </Suspense>
  );
}
