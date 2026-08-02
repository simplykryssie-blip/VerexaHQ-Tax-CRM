"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { saveLeadFormAction, setLeadFormStatusAction } from "@/lib/actions/lead-forms";

const OPTIONS=[
  ["first_name","First name"],["last_name","Last name"],["email","Email"],["phone","Phone"],["company","Company"],["services","Services needed"],["preferred_contact_method","Preferred contact"],["description","How can we help?"]
] as const;

export function LeadFormBuilder({form,canPublish}:{form:{id:string;name:string;public_slug:string;status:string;confirmation_message:string;consent_text:string;embed_settings:unknown};canPublish:boolean}){
  const settings=(form.embed_settings&&typeof form.embed_settings==="object"&&!Array.isArray(form.embed_settings)?form.embed_settings:{}) as Record<string,unknown>;
  const [values,setValues]=useState({name:form.name,slug:form.public_slug,heading:String(settings.heading??form.name),description:String(settings.description??""),confirmationMessage:form.confirmation_message,consentText:form.consent_text,accentColor:String(settings.accent_color??"#0f766e"),fields:Array.isArray(settings.fields)?settings.fields.map(String):["first_name","last_name","email","phone","services","description"]});
  const [pending,start]=useTransition(); const router=useRouter();
  const publicPath=`/forms/${values.slug}`;
  const runStatus=(status:"draft"|"published"|"paused"|"archived")=>start(async()=>{const result=await setLeadFormStatusAction(form.id,status);if(result.error)toast.error(result.error);else{toast.success(result.success!);router.refresh();}});
  const save=()=>start(async()=>{const result=await saveLeadFormAction({id:form.id,...values});if(result.error)toast.error(result.error);else{toast.success(result.success!);router.refresh();}});
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
    <div className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between"><div><h2 className="font-semibold">Form settings</h2><p className="text-sm text-muted-foreground">Public forms never collect SSNs, banking details, or tax documents.</p></div><Badge variant="secondary">{form.status}</Badge></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><Label>Internal name</Label><Input className="mt-1" value={values.name} onChange={e=>setValues({...values,name:e.target.value})}/></div><div><Label>Public URL</Label><Input className="mt-1" value={values.slug} onChange={e=>setValues({...values,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")})}/></div></div>
      <div><Label>Public heading</Label><Input className="mt-1" value={values.heading} onChange={e=>setValues({...values,heading:e.target.value})}/></div>
      <div><Label>Description</Label><Textarea className="mt-1" value={values.description} onChange={e=>setValues({...values,description:e.target.value})}/></div>
      <div><Label>Fields</Label><div className="mt-2 grid gap-2 sm:grid-cols-2">{OPTIONS.map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"><Checkbox checked={values.fields.includes(key)} onCheckedChange={checked=>setValues({...values,fields:checked?[...values.fields,key]:values.fields.filter(item=>item!==key)})}/>{label}</label>)}</div></div>
      <div><Label>Consent text</Label><Textarea className="mt-1" value={values.consentText} onChange={e=>setValues({...values,consentText:e.target.value})}/></div>
      <div><Label>Confirmation message</Label><Textarea className="mt-1" value={values.confirmationMessage} onChange={e=>setValues({...values,confirmationMessage:e.target.value})}/></div>
      <div className="flex flex-wrap gap-2"><Button variant="brand" disabled={pending} onClick={save}>Save draft</Button>{canPublish&&form.status!=="published"&&<Button disabled={pending} onClick={()=>runStatus("published")}>Publish</Button>}{canPublish&&form.status==="published"&&<Button variant="outline" disabled={pending} onClick={()=>runStatus("paused")}>Pause</Button>}{canPublish&&<Button variant="ghost" disabled={pending} onClick={()=>runStatus("archived")}>Archive</Button>}</div>
    </div>
    <div className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">Preview</h2><div className="flex gap-1"><Button variant="ghost" size="icon" title="Copy public link" onClick={()=>{navigator.clipboard.writeText(`${location.origin}${publicPath}`);toast.success("Link copied");}}><Copy className="size-4"/></Button><Button asChild variant="ghost" size="icon"><a href={publicPath} target="_blank" aria-label="Open public form"><ExternalLink className="size-4"/></a></Button></div></div><div className="rounded-2xl border border-border bg-white p-6 shadow-sm"><div className="h-1.5 rounded-full" style={{backgroundColor:values.accentColor}}/><h3 className="mt-5 text-xl font-semibold">{values.heading}</h3><p className="mt-1 text-sm text-muted-foreground">{values.description}</p><div className="mt-5 space-y-3">{values.fields.map(field=><div key={field}><span className="text-xs font-medium">{OPTIONS.find(([key])=>key===field)?.[1]??field}</span><div className="mt-1 h-10 rounded-md border border-border bg-muted/20"/></div>)}</div></div></div>
  </div>;
}
