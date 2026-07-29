"use client";

// Plan 10 graduates this demo-only surface.

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Plus, Radar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { adminService } from "@/features/platform/admin-service";
import type { TelemetryCategory, TelemetryLink } from "@/lib/types";

const CATEGORIES: TelemetryCategory[] = ["monitoring", "logs", "analytics", "infra", "other"];

type LinkDraft = Omit<TelemetryLink, "id">;
const EMPTY_DRAFT: LinkDraft = { name: "", url: "", category: "monitoring" };

function validUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export default function AdminSettingsPage() {
  const [links, setLinks] = useState<TelemetryLink[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LinkDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLinks(await adminService.listTelemetryLinks());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  }

  function openEdit(link: TelemetryLink) {
    setEditingId(link.id);
    setDraft({ name: link.name, url: link.url, category: link.category });
    setDialogOpen(true);
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (!validUrl(draft.url.trim())) {
      toast.error("Enter a valid http(s) URL.");
      return;
    }
    setSaving(true);
    const input = { ...draft, name: draft.name.trim(), url: draft.url.trim() };
    if (editingId) {
      await adminService.updateTelemetryLink(editingId, input);
      toast.success(`${input.name} updated`);
    } else {
      await adminService.createTelemetryLink(input);
      toast.success(`${input.name} added`);
    }
    setSaving(false);
    setDialogOpen(false);
    await refresh();
  }

  async function remove(link: TelemetryLink) {
    await adminService.deleteTelemetryLink(link.id);
    toast.info(`${link.name} removed`);
    await refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform settings"
        description="Shortcuts to the observability tools running outside the app — links only, the stats stay in their dashboards."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Add link
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radar className="size-4 text-primary" /> Telemetry shortcuts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {links === null ? (
            <ListSkeleton rows={4} rowHeight="h-14" />
          ) : links.length === 0 ? (
            <EmptyState
              icon={Radar}
              title="No telemetry links yet"
              description="Add shortcuts to Sentry, Grafana or any tool you use to watch the platform."
              action={
                <Button variant="outline" onClick={openCreate}>
                  <Plus className="size-4" /> Add link
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {links.map((link) => (
                <li
                  key={link.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{link.name}</p>
                      <Badge variant="secondary" className="capitalize">{link.category}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{link.url}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="outline" size="sm" asChild>
                      <a href={link.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" /> Open
                      </a>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(link)}>
                      Edit
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                          aria-label={`Delete ${link.name}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title={`Remove ${link.name}?`}
                      description="The shortcut disappears from the admin overview. The external tool itself is untouched."
                      confirmLabel="Remove link"
                      destructive
                      onConfirm={() => remove(link)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit telemetry link" : "Add telemetry link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tel-name">Name</Label>
              <Input
                id="tel-name"
                placeholder="e.g. Sentry — errors"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tel-url">URL</Label>
              <Input
                id="tel-url"
                type="url"
                placeholder="https://sentry.io/organizations/…"
                value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tel-category">Category</Label>
              <Select
                value={draft.category}
                onValueChange={(category) =>
                  setDraft((d) => ({ ...d, category: category as TelemetryCategory }))
                }
              >
                <SelectTrigger id="tel-category" className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category} className="capitalize">
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving ? "Saving…" : editingId ? "Save changes" : "Add link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
