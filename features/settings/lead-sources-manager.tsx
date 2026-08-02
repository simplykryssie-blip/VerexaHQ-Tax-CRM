"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { toast } from "@/components/ui/toaster";
import type { Tables } from "@/types/database";

type LeadSource = Tables<"lead_sources">;

export function LeadSourcesManager({ workspaceId, sources }: { workspaceId: string; sources: LeadSource[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const sorted = [...sources].sort((a, b) => a.sort_order - b.sort_order);
  const workspaceSources = sorted.filter((s) => !s.is_system);
  const systemSources = sorted.filter((s) => s.is_system);

  async function addSource() {
    if (!newLabel.trim()) return;
    setAdding(true);
    const supabase = createClient();
    const nextSort = (workspaceSources.at(-1)?.sort_order ?? 100) + 10;
    const { error } = await supabase.from("lead_sources").insert({
      workspace_id: workspaceId,
      label: newLabel.trim(),
      sort_order: nextSort,
    });
    setAdding(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    setNewLabel("");
    toast.success("Lead source added");
    router.refresh();
  }

  async function toggleActive(source: LeadSource) {
    setBusyId(source.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("lead_sources")
      .update({ is_active: !source.is_active, archived_at: source.is_active ? new Date().toISOString() : null })
      .eq("id", source.id);
    setBusyId(null);
    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    router.refresh();
  }

  async function move(source: LeadSource, direction: -1 | 1) {
    const list = workspaceSources;
    const index = list.findIndex((s) => s.id === source.id);
    const swapWith = list[index + direction];
    if (!swapWith) return;
    setBusyId(source.id);
    const supabase = createClient();
    await Promise.all([
      supabase.from("lead_sources").update({ sort_order: swapWith.sort_order }).eq("id", source.id),
      supabase.from("lead_sources").update({ sort_order: source.sort_order }).eq("id", swapWith.id),
    ]);
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your workspace&apos;s sources</p>
        {workspaceSources.length === 0 && (
          <p className="text-sm text-muted-foreground">No custom sources yet — add one below, or use the standard list.</p>
        )}
        {workspaceSources.map((source, i) => (
          <div key={source.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{source.label}</span>
              {!source.is_active && <Badge variant="outline">Inactive</Badge>}
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" disabled={busyId === source.id || i === 0} onClick={() => move(source, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busyId === source.id || i === workspaceSources.length - 1}
                onClick={() => move(source, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" disabled={busyId === source.id} onClick={() => toggleActive(source)}>
                {busyId === source.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {source.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2">
          <Input placeholder="New source (e.g. Trade show)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <Button variant="outline" disabled={adding || !newLabel.trim()} onClick={addSource}>
            {adding && <Loader2 className="h-4 w-4 animate-spin" />}
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Standard sources (shared across all workspaces)</p>
        <div className="flex flex-wrap gap-2">
          {systemSources.map((source) => (
            <Badge key={source.id} variant="secondary">
              {source.label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
