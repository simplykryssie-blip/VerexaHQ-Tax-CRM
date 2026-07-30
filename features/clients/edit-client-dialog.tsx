"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { toast } from "@/components/ui/toaster";
import {
  CLIENT_TYPES,
  CLIENT_TYPE_LABELS,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  CONTACT_METHODS,
} from "@/lib/validation/clients";
import type { Tables } from "@/types/database";

export function EditClientDialog({ client }: { client: Tables<"clients"> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientType, setClientType] = useState(client.client_type);
  const [firstName, setFirstName] = useState(client.first_name ?? "");
  const [lastName, setLastName] = useState(client.last_name ?? "");
  const [company, setCompany] = useState(client.company ?? "");
  const [email, setEmail] = useState(client.email ?? "");
  const [phone, setPhone] = useState(client.phone ?? "");
  const [preferredContactMethod, setPreferredContactMethod] = useState<(typeof CONTACT_METHODS)[number] | "">(
    (client.preferred_contact_method as (typeof CONTACT_METHODS)[number] | null) ?? "",
  );
  const [preferredLanguage, setPreferredLanguage] = useState(client.preferred_language ?? "en");
  const [dateOfBirth, setDateOfBirth] = useState(client.date_of_birth ?? "");
  const [ssnLast4, setSsnLast4] = useState(client.ssn_last4 ?? "");
  const [einLast4, setEinLast4] = useState(client.ein_last4 ?? "");
  const [source, setSource] = useState(client.source ?? "");
  const [status, setStatus] = useState(client.status as (typeof CLIENT_STATUSES)[number]);

  const isBusiness = clientType === "business" || clientType === "organization";

  async function onSave() {
    setError(null);
    if (!isBusiness && (!firstName.trim() || !lastName.trim())) {
      setError("First and last name are required for this client type.");
      return;
    }
    if (isBusiness && !company.trim()) {
      setError("Company name is required for this client type.");
      return;
    }
    if (ssnLast4 && !/^\d{4}$/.test(ssnLast4)) {
      setError("SSN last 4 must be exactly 4 digits.");
      return;
    }
    if (einLast4 && !/^\d{4}$/.test(einLast4)) {
      setError("EIN last 4 must be exactly 4 digits.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("clients")
      .update({
        client_type: clientType,
        first_name: firstName || company || "—",
        last_name: lastName || "",
        company: company || null,
        email: email || null,
        phone: phone || null,
        preferred_contact_method: preferredContactMethod || null,
        preferred_language: preferredLanguage || "en",
        date_of_birth: dateOfBirth || null,
        ssn_last4: ssnLast4 || null,
        ein_last4: einLast4 || null,
        source: source || null,
        status,
      })
      .eq("id", client.id);

    setSubmitting(false);
    if (dbError) {
      setError(friendlyDbError(dbError.message));
      return;
    }
    toast.success("Client updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit client</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1">
            <Label>Client type</Label>
            <Select value={clientType} onValueChange={(v) => setClientType(v as typeof clientType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CLIENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isBusiness ? (
            <div className="space-y-1">
              <Label>Company name</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Preferred contact method</Label>
              <Select
                value={preferredContactMethod || undefined}
                onValueChange={(v) => setPreferredContactMethod(v as (typeof CONTACT_METHODS)[number])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {CLIENT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date of birth</Label>
              <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Preferred language</Label>
              <Input value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>SSN — last 4 digits</Label>
              <Input maxLength={4} value={ssnLast4} onChange={(e) => setSsnLast4(e.target.value)} placeholder="1234" />
            </div>
            <div className="space-y-1">
              <Label>EIN — last 4 digits</Label>
              <Input maxLength={4} value={einLast4} onChange={(e) => setEinLast4(e.target.value)} placeholder="1234" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Referral, website, converted lead…" />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="brand" disabled={submitting} onClick={onSave}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
