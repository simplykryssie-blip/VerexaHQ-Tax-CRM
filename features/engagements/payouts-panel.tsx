"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { PAYOUT_METHOD_LABELS, PAYOUT_STATUS_LABELS, payoutMethodLabel, payoutStatusLabel } from "@/lib/validation/ero-review";
import type { Enums, Tables } from "@/types/database";

type PayoutMethod = Enums<"payout_method">;
type PayoutStatus = Enums<"payout_status">;

export function PayoutsPanel({
  workspaceId,
  engagementId,
  bankProducts,
  payouts,
  canManage,
}: {
  workspaceId: string;
  engagementId: string;
  bankProducts: Tables<"bank_products">[];
  payouts: Tables<"payouts">[];
  canManage: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [bankOpen, setBankOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [productType, setProductType] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [savingBank, setSavingBank] = useState(false);

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayoutMethod>("via_ero");
  const [status, setStatus] = useState<PayoutStatus>("pending");
  const [bankProductId, setBankProductId] = useState<string>("none");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);

  async function addBankProduct() {
    if (!bankName.trim()) return;
    setSavingBank(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("bank_products").insert({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      bank_name: bankName.trim(),
      product_type: productType.trim() || "other",
      fee_amount: feeAmount ? Number(feeAmount) : null,
      created_by: user?.id ?? null,
    });
    setSavingBank(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    toast.success("Bank product added");
    setBankOpen(false);
    setBankName("");
    setProductType("");
    setFeeAmount("");
    router.refresh();
  }

  async function addPayout() {
    const amountNum = Number(amount);
    if (!amount || Number.isNaN(amountNum)) return;
    setSavingPayout(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("payouts").insert({
      workspace_id: workspaceId,
      engagement_id: engagementId,
      recipient_workspace_id: workspaceId,
      amount: amountNum,
      method,
      status,
      bank_product_id: bankProductId === "none" ? null : bankProductId,
      reference_number: referenceNumber || null,
      paid_at: paidAt || null,
      notes: notes || null,
      created_by: user?.id ?? null,
    });
    setSavingPayout(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    toast.success("Payout logged");
    setPayoutOpen(false);
    setAmount("");
    setMethod("via_ero");
    setStatus("pending");
    setBankProductId("none");
    setReferenceNumber("");
    setPaidAt("");
    setNotes("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Bank products</CardTitle>
          {canManage && (
            <Dialog open={bankOpen} onOpenChange={setBankOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" /> Add bank product
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add a bank product</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Bank name</Label>
                    <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Product type</Label>
                    <Input value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="e.g. Refund Transfer, Refund Advance" />
                  </div>
                  <div className="space-y-1">
                    <Label>Fee amount</Label>
                    <Input type="number" step="0.01" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="brand" disabled={savingBank || !bankName.trim()} onClick={addBankProduct}>
                    {savingBank && <Loader2 className="h-4 w-4 animate-spin" />}
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {bankProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No bank products logged for this engagement.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {bankProducts.map((b) => (
                <li key={b.id} className="rounded-md border border-border p-2 flex items-center justify-between">
                  <div>
                    <span className="font-medium">{b.bank_name}</span>
                    <span className="text-muted-foreground"> · {b.product_type}</span>
                  </div>
                  {b.fee_amount != null && <span className="text-xs text-muted-foreground">{formatCurrency(b.fee_amount)} fee</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Payouts</CardTitle>
          {canManage && (
            <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="h-4 w-4" /> Log payout
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log a payout</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Method</Label>
                    <Select value={method} onValueChange={(v) => setMethod(v as PayoutMethod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYOUT_METHOD_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as PayoutStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYOUT_STATUS_LABELS).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {bankProducts.length > 0 && (
                    <div className="space-y-1">
                      <Label>Bank product</Label>
                      <Select value={bankProductId} onValueChange={setBankProductId}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {bankProducts.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.bank_name} — {b.product_type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>Reference number</Label>
                    <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Paid date</Label>
                    <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="brand" disabled={savingPayout || !amount} onClick={addPayout}>
                    {savingPayout && <Loader2 className="h-4 w-4 animate-spin" />}
                    Log payout
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payouts logged for this engagement.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {payouts.map((p) => (
                <li key={p.id} className="rounded-md border border-border p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                    <Badge variant={p.status === "paid" ? "success" : p.status === "failed" ? "destructive" : "secondary"}>{payoutStatusLabel(p.status)}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {payoutMethodLabel(p.method)}
                    {p.reference_number && ` · Ref: ${p.reference_number}`}
                    {p.paid_at && ` · Paid ${formatDate(p.paid_at)}`}
                  </div>
                  {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
