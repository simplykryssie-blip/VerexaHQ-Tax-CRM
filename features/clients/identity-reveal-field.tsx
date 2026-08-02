"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { maskEin, maskSsn } from "@/lib/utils";

const REVEAL_TIMEOUT_MS = 20_000;

/**
 * Masked SSN/EIN/ITIN display with permission-gated, password-reauthenticated
 * reveal. This app only supports email/password sign-in (no OAuth or MFA
 * enrollment exists), so password reauthentication is the only — and
 * complete — reauth path available; there is nothing to fall back to.
 * The revealed value auto-remasks on a short timeout, on tab blur, and on
 * unmount (navigating away); it is never logged, and no copy affordance is
 * provided for the full value.
 */
export function IdentityRevealField({
  workspaceId,
  clientId,
  identifierType,
  last4,
  canReveal,
  canManage,
}: {
  workspaceId: string;
  clientId: string;
  identifierType: "ssn" | "ein" | "itin";
  last4: string | null;
  canReveal: boolean;
  canManage: boolean;
}) {
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState("");
  const [newValue, setNewValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  function remask() {
    setRevealedValue(null);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }

  useEffect(() => {
    if (!revealedValue) return;
    timeoutRef.current = window.setTimeout(remask, REVEAL_TIMEOUT_MS);
    function onVisibilityChange() {
      if (document.hidden) remask();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [revealedValue]);

  useEffect(() => remask, []);

  async function handleReveal() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setBusy(false);
      setError("Unable to verify your account.");
      return;
    }
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (authError) {
      setBusy(false);
      setError("Incorrect password.");
      return;
    }
    const { data, error: rpcError } = await supabase.rpc("reveal_client_identity_value", {
      p_workspace_id: workspaceId,
      p_client_id: clientId,
      p_identifier_type: identifierType,
    });
    setBusy(false);
    if (rpcError) {
      setError(friendlyDbError(rpcError.message));
      return;
    }
    setRevealedValue(data);
    setPromptOpen(false);
    setPassword("");
  }

  async function handleSetValue() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("set_client_identity_value", {
      p_workspace_id: workspaceId,
      p_client_id: clientId,
      p_identifier_type: identifierType,
      p_value: newValue,
    });
    setBusy(false);
    if (rpcError) {
      setError(friendlyDbError(rpcError.message));
      return;
    }
    setEditing(false);
    setNewValue("");
    window.location.reload();
  }

  const mask = identifierType === "ein" ? maskEin : maskSsn;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{revealedValue ?? mask(last4)}</span>
        {revealedValue ? (
          <Button variant="ghost" size="sm" onClick={remask}>
            <EyeOff className="h-3.5 w-3.5" /> Hide
          </Button>
        ) : canReveal ? (
          <Button variant="ghost" size="sm" onClick={() => setPromptOpen((v) => !v)}>
            <Eye className="h-3.5 w-3.5" /> Reveal
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Reveal requires additional permission</span>
        )}
        {canManage && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> {last4 ? "Replace" : "Add"}
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="max-w-sm">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {promptOpen && (
        <div className="flex items-end gap-2 rounded-md border border-border p-2 max-w-sm">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">Re-enter your password to reveal</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </div>
          <Button size="sm" variant="brand" disabled={busy || !password} onClick={handleReveal}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </div>
      )}

      {editing && (
        <div className="flex items-end gap-2 rounded-md border border-border p-2 max-w-sm">
          <div className="space-y-1 flex-1">
            <Label className="text-xs">
              Full {identifierType === "ein" ? "EIN" : identifierType === "itin" ? "ITIN" : "SSN"} (9 digits)
            </Label>
            <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder="123-45-6789" autoFocus />
          </div>
          <Button size="sm" variant="brand" disabled={busy || !newValue} onClick={handleSetValue}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
