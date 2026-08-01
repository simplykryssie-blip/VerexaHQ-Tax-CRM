"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";
import { Button } from "@/components/ui/LegacyButton";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toast } from "@/lib/toast";
import { addEngagementNoteAction } from "@/lib/actions/engagements";
import { formatDateTime } from "@/lib/utils";
import type { EngagementNote } from "@/lib/types";
import type { UserSummary } from "@/lib/data/users";

export function EngagementNotesTab({
  engagementId,
  notes,
  userMap,
}: {
  engagementId: string;
  notes: EngagementNote[];
  userMap: Map<string, UserSummary>;
}) {
  const [body, setBody] = useState("");
  const [isClientVisible, setIsClientVisible] = useState(false);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await addEngagementNoteAction({ engagementId, body, isClientVisible });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Note added.");
      setBody("");
      setIsClientVisible(false);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Add a note</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <FormField label="Note" htmlFor="noteBody">
            <textarea id="noteBody" rows={3} className={inputClassName} value={body} onChange={(e) => setBody(e.target.value)} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={isClientVisible} onChange={(e) => setIsClientVisible(e.target.checked)} />
            Visible to the client in their portal
          </label>
          <div className="flex justify-end">
            <Button size="sm" loading={isPending} onClick={submit}>
              Add note
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Notes ({notes.length})</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-muted">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted">
                    {note.author_user_id ? userMap.get(note.author_user_id)?.name ?? "Staff member" : "System"} ·{" "}
                    {formatDateTime(note.created_at)}
                  </p>
                  {note.is_client_visible && <StatusBadge label="Client-visible" tone="info" />}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
