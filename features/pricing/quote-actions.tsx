"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog,DialogContent,DialogFooter,DialogHeader,DialogTitle,DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { createChangeOrderAction, expireQuoteAction, sendQuoteAction } from "@/lib/actions/pricing";

export function StaffQuoteActions({ id, status, canSend, canChangeOrder=false }: { id: string; status: string; canSend: boolean; canChangeOrder?:boolean }) {
  const [pending,start]=useTransition(); const router=useRouter(); const [open,setOpen]=useState(false); const [description,setDescription]=useState(""); const [amount,setAmount]=useState(""); const [validUntil,setValidUntil]=useState("");
  const run=(kind:"send"|"expire")=>start(async()=>{const result=kind==="send"?await sendQuoteAction(id):await expireQuoteAction(id);if(result.error)toast.error(result.error);else{toast.success(result.success!);router.refresh();}});
  const createOrder=()=>start(async()=>{const result=await createChangeOrderAction({quoteId:id,description,amount:Number(amount),validUntil:validUntil||undefined});if(result.error)toast.error(result.error);else{toast.success(result.success!);setOpen(false);router.push(`/quotes/${result.id}`);router.refresh();}});
  return <div className="flex gap-2">{canSend&&status==="draft"&&<Button variant="brand" disabled={pending} onClick={()=>run("send")}>Send to portal</Button>}{canSend&&["draft","sent","viewed"].includes(status)&&<Button variant="outline" disabled={pending} onClick={()=>run("expire")}>Expire quote</Button>}{canChangeOrder&&status==="accepted"&&<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="brand">Create change order</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>New quote change order</DialogTitle></DialogHeader><div className="space-y-4"><p className="text-sm text-muted-foreground">The accepted quote remains locked. This creates a separate client-approved scope change linked to it.</p><div><Label>Additional scope</Label><Textarea className="mt-1" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the work added or changed"/></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Additional amount</Label><Input className="mt-1" type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div><div><Label>Valid until</Label><Input className="mt-1" type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></div></div></div><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button variant="brand" disabled={pending||description.trim().length<3||!amount} onClick={createOrder}>Create draft</Button></DialogFooter></DialogContent></Dialog>}</div>;
}
