"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { toast } from "@/components/ui/toaster";
import type { Tables } from "@/types/database";
import { Loader2, Plus } from "lucide-react";

type ClientAddress = Tables<"client_addresses">;

const ADDRESS_TYPES = ["physical", "mailing", "business", "other"] as const;

export function ClientAddressesTab({
  clientId,
  workspaceId,
  addresses,
}: {
  clientId: string;
  workspaceId: string;
  addresses: ClientAddress[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    addressType: "physical" as (typeof ADDRESS_TYPES)[number],
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
  });

  async function addAddress() {
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.from("client_addresses").insert({
      workspace_id: workspaceId,
      client_id: clientId,
      address_type: form.addressType,
      is_primary: addresses.length === 0,
      line1: form.line1 || null,
      line2: form.line2 || null,
      city: form.city || null,
      state: form.state || null,
      postal_code: form.postalCode || null,
      country: form.country || "US",
    });
    setSubmitting(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    toast.success("Address added");
    setAdding(false);
    setForm({ addressType: "physical", line1: "", line2: "", city: "", state: "", postalCode: "", country: "US" });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Addresses</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" /> Add address
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="rounded-md border border-border p-3 space-y-2">
            <Select value={form.addressType} onValueChange={(v) => setForm({ ...form, addressType: v as typeof form.addressType })}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADDRESS_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Address line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
            <Input placeholder="Address line 2" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              <Input placeholder="ZIP" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
            </div>
            <Input placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
            <Button variant="brand" size="sm" onClick={addAddress} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save address
            </Button>
          </div>
        )}

        {addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No address on file.</p>
        ) : (
          <ul className="divide-y divide-border">
            {addresses.map((a) => (
              <li key={a.id} className="py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{a.address_type}</span>
                  {a.is_primary && <Badge variant="success">Primary</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[a.line1, a.line2, a.city, a.state, a.postal_code, a.country].filter(Boolean).join(", ") || "No address on file"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
