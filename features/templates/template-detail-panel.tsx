"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Rocket, Archive, Plus, Copy, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { toast } from "@/components/ui/toaster";
import { templateStatusLabel, TEMPLATE_VISIBILITY_LABELS } from "@/lib/validation/templates";
import { formatDateTime } from "@/lib/formatters";
import { customizeSystemTemplate } from "@/features/templates/customize-template";
import { OrganizerStructureViewer } from "@/features/templates/organizer-structure-viewer";
import type { TemplateUsage } from "@/features/templates/queries";
import type { Tables } from "@/types/database";

type TemplateRow = Tables<"templates">;
type VersionRow = Tables<"template_versions">;

function friendlyLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function friendlyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map((v) => friendlyValue(v)).join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** A readable key/value fallback for content shapes this panel doesn't have
 * a dedicated renderer for yet — used instead of a raw JSON dump so staff
 * never see an unexplained blank page or literal "{}"/JSON text. */
function FriendlyContentPreview({ content }: { content: Record<string, unknown> }) {
  const entries = Object.entries(content);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">This template has no content yet.</p>;
  }
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{friendlyLabel(key)}</dt>
          <dd className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">{friendlyValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TemplateDetailPanel({
  template,
  versions,
  workspaceId,
  usage,
}: {
  template: TemplateRow;
  versions: VersionRow[];
  workspaceId: string;
  usage: TemplateUsage[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState(template.current_version_id ?? versions[0]?.id ?? "");
  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0];

  const content = (selectedVersion?.content as Record<string, unknown>) ?? {};
  const [subject, setSubject] = useState(typeof content.subject === "string" ? content.subject : "");
  const [bodyText, setBodyText] = useState(typeof content.body_text === "string" ? content.body_text : "");
  const [bodyHtml, setBodyHtml] = useState(typeof content.body_html === "string" ? content.body_html : "");
  const [jsonContent, setJsonContent] = useState(JSON.stringify(content, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const hasBodyHtml = typeof content.body_html === "string";

  const canManage = template.is_system_template !== true;
  const isEditableVersion = canManage && selectedVersion?.status === "draft";

  async function handleCustomize() {
    if (!selectedVersion) return;
    setCustomizing(true);
    try {
      const newId = await customizeSystemTemplate(template, selectedVersion, workspaceId);
      toast.success("Created your own editable copy");
      router.push(`/templates/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create a copy. Please try again.");
    } finally {
      setCustomizing(false);
    }
  }

  async function saveContent() {
    if (!selectedVersion) return;
    let nextContent: Record<string, unknown>;
    if (template.kind === "message") {
      nextContent = { subject, body_text: bodyText };
    } else if (hasBodyHtml && !showRawJson) {
      nextContent = { ...content, body_html: bodyHtml };
    } else {
      try {
        nextContent = JSON.parse(jsonContent);
        setJsonError(null);
      } catch {
        setJsonError("That's not valid JSON.");
        return;
      }
    }
    setBusy(true);
    const { error } = await supabase.from("template_versions").update({ content: nextContent as never }).eq("id", selectedVersion.id);
    setBusy(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    toast.success("Version saved");
    router.refresh();
  }

  async function publishVersion() {
    if (!selectedVersion) return;
    setBusy(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: vError } = await supabase
      .from("template_versions")
      .update({ status: "published", published_at: new Date().toISOString(), published_by: user?.id ?? null })
      .eq("id", selectedVersion.id);
    if (vError) {
      toast.error(friendlyDbError(vError.message));
      setBusy(false);
      return;
    }
    const { error: tError } = await supabase
      .from("templates")
      .update({ status: "published", current_version_id: selectedVersion.id, latest_published_version_id: selectedVersion.id, published_at: new Date().toISOString() })
      .eq("id", template.id);
    setBusy(false);
    if (tError) {
      toast.error(friendlyDbError(tError.message));
      return;
    }
    toast.success("Version published");
    router.refresh();
  }

  async function newDraftVersion() {
    setBusy(true);
    const nextNumber = Math.max(...versions.map((v) => v.version_number), 0) + 1;
    const { data, error } = await supabase
      .from("template_versions")
      .insert({ template_id: template.id, version_number: nextNumber, status: "draft", name: template.name, content: selectedVersion?.content ?? {} })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      toast.error(friendlyDbError(error?.message));
      return;
    }
    await supabase.from("templates").update({ current_version_id: data.id }).eq("id", template.id);
    toast.success("New draft version created");
    router.refresh();
  }

  async function archiveTemplate() {
    const usageWarning = usage.length > 0
      ? ` It is currently used by ${usage.length} active ${usage.length === 1 ? "item" : "items"} (${usage.map((u) => u.name).join(", ")}) — those will keep their existing reference, but it will no longer be assignable to new work.`
      : "";
    if (!confirm(`Archive this template?${usageWarning} It will no longer be assignable.`)) return;
    setBusy(true);
    const { error } = await supabase.from("templates").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", template.id);
    setBusy(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    toast.success("Template archived");
    router.refresh();
  }

  async function updateVisibility(v: string) {
    setBusy(true);
    const { error } = await supabase.from("templates").update({ visibility: v as never }).eq("id", template.id);
    setBusy(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
          <div>
            <CardTitle className="text-base">{template.name}</CardTitle>
            {template.description && <CardDescription>{template.description}</CardDescription>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={template.status === "published" ? "success" : template.status === "archived" ? "destructive" : "secondary"}>
              {templateStatusLabel(template.status)}
            </Badge>
            {template.is_system_template && <Badge variant="outline">System</Badge>}
            {canManage && template.status !== "archived" && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={archiveTemplate}>
                <Archive className="h-4 w-4" /> Archive
              </Button>
            )}
          </div>
        </CardHeader>
        {canManage && (
          <CardContent>
            <div className="space-y-1 max-w-[240px]">
              <Label className="text-xs">Visibility</Label>
              <Select value={template.visibility} onValueChange={updateVisibility} disabled={busy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TEMPLATE_VISIBILITY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        )}
      </Card>

      {usage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Used by</CardTitle>
            <CardDescription>Archiving or removing this template affects these — check before making changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {usage.map((item) => (
              <div key={`${item.kind}-${item.id}`} className="flex items-center justify-between rounded-md border border-border p-2.5 text-sm">
                <span className="font-medium">{item.name}</span>
                {item.kind === "workflow" ? (
                  <a href={`/workflows/${item.id}`} className="text-xs font-medium text-accent-700 underline underline-offset-2">
                    View attached workflow
                  </a>
                ) : (
                  <Badge variant="outline">Service package</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Versions</CardTitle>
          {canManage && (
            <Button size="sm" variant="outline" disabled={busy} onClick={newDraftVersion}>
              <Plus className="h-4 w-4" /> New draft version
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedVersionId(v.id)}
              className={`w-full text-left rounded-md border p-2.5 text-sm ${v.id === selectedVersionId ? "border-brand bg-brand/5" : "border-border"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Version {v.version_number}</span>
                <Badge variant={v.status === "published" ? "success" : "secondary"}>{templateStatusLabel(v.status)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {!canManage && (
        <Card className="border-brand/30 bg-brand/5">
          <CardContent className="pt-5 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-2.5">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">This is a preloaded template</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  You can view every question below, but preloaded templates can&apos;t be edited directly — create your own
                  copy to change wording, add or remove questions, or adjust which documents are requested.
                </p>
              </div>
            </div>
            <Button size="sm" variant="brand" disabled={customizing} onClick={handleCustomize}>
              {customizing && <Loader2 className="h-4 w-4 animate-spin" />}
              <Copy className="h-4 w-4" /> Customize this template
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedVersion && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {canManage ? `Content — Version ${selectedVersion.version_number}` : "Questions in this organizer"}
            </CardTitle>
            {isEditableVersion && (
              <Button size="sm" variant="brand" disabled={busy} onClick={publishVersion}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                <Rocket className="h-4 w-4" /> Publish
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {canManage && !isEditableVersion && (
              <p className="text-xs text-muted-foreground">Published versions are read-only — create a new draft version to edit.</p>
            )}
            {template.kind === "form" ? (
              <OrganizerStructureViewer templateVersionId={selectedVersion.id} editable={isEditableVersion} />
            ) : template.kind === "message" ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Subject</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!isEditableVersion} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Body</Label>
                  <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={8} disabled={!isEditableVersion} />
                </div>
              </>
            ) : hasBodyHtml && !showRawJson ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Letter body (HTML)</Label>
                  <Textarea value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)} rows={10} disabled={!isEditableVersion} className="font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preview</Label>
                  <div
                    className="rounded-md border border-border p-4 text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h1]:mb-2 [&_h2]:mt-4 [&_h2]:mb-1 [&_p]:mb-2"
                    dangerouslySetInnerHTML={{ __html: bodyHtml || "<p class='text-muted-foreground'>No content yet.</p>" }}
                  />
                </div>
              </>
            ) : !showRawJson ? (
              <FriendlyContentPreview content={content} />
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Content (JSON)</Label>
                <Textarea value={jsonContent} onChange={(e) => setJsonContent(e.target.value)} rows={12} disabled={!isEditableVersion} className="font-mono text-xs" />
                {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
              </div>
            )}
            {template.kind !== "form" && template.kind !== "message" && (
              <button
                type="button"
                onClick={() => setShowRawJson((v) => !v)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {showRawJson ? "Back to friendly view" : "Edit as JSON (advanced)"}
              </button>
            )}
            {isEditableVersion && template.kind !== "form" && (template.kind === "message" || hasBodyHtml || showRawJson) && (
              <Button size="sm" variant="outline" disabled={busy} onClick={saveContent}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Save content
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
