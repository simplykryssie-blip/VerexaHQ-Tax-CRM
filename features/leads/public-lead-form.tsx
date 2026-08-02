"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { submitPublicLeadFormAction } from "@/lib/actions/lead-forms";

const LABELS:Record<string,string>={first_name:"First name",last_name:"Last name",email:"Email address",phone:"Phone number",company:"Company",services:"Services needed",preferred_contact_method:"Preferred contact method",description:"How can we help?"};

export function PublicLeadForm({slug,fields,consentText,accentColor}:{slug:string;fields:string[];consentText:string;accentColor:string}){
  const [pending,start]=useTransition(); const [message,setMessage]=useState<string|null>(null); const [error,setError]=useState<string|null>(null);
  if(message)return <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><h2 className="font-semibold">Request received</h2><p className="mt-1 text-sm">{message}</p></div>;
  return <form className="space-y-4" action={formData=>start(async()=>{setError(null);const result=await submitPublicLeadFormAction(slug,formData);if(result.error)setError(result.error);else setMessage(result.success!);})}>
    <input name="website" tabIndex={-1} autoComplete="off" className="absolute -left-[9999px]" aria-hidden="true"/>
    <div className="grid gap-4 sm:grid-cols-2">{fields.filter(field=>field!=="description"&&field!=="services").map(field=><div key={field} className={field==="company"?"sm:col-span-2":""}><Label htmlFor={field}>{LABELS[field]??field}</Label><Input className="mt-1" id={field} name={field} type={field==="email"?"email":field==="phone"?"tel":"text"} required={["first_name","last_name","email","phone"].includes(field)}/></div>)}</div>
    {fields.includes("services")&&<div><Label htmlFor="services">Services needed</Label><Input className="mt-1" id="services" name="services" placeholder="Tax preparation, bookkeeping, payroll…"/></div>}
    {fields.includes("description")&&<div><Label htmlFor="description">How can we help?</Label><Textarea className="mt-1" id="description" name="description" rows={4}/></div>}
    <label className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm"><Checkbox name="consent" required/><span>{consentText}</span></label>
    {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <Button type="submit" variant="brand" className="w-full" disabled={pending} style={{backgroundColor:accentColor}}>{pending?"Sending…":"Request consultation"}</Button>
  </form>;
}
