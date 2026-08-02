import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicLeadForm } from "@/features/leads/public-lead-form";

type PublicForm={name:string;public_slug:string;heading:string;description:string;confirmation_message:string;consent_text:string;accent_color:string;fields:string[]};

export default async function PublishedLeadFormPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params; const supabase=await createClient(); const {data,error}=await supabase.rpc("get_public_lead_form",{p_public_slug:slug}); if(error||!data)notFound(); const form=data as unknown as PublicForm;
  return <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16"><section className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9"><div className="h-1.5 rounded-full" style={{backgroundColor:form.accent_color}}/><p className="mt-6 text-xs font-semibold uppercase tracking-[.16em] text-slate-500">Secure inquiry</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{form.heading}</h1>{form.description&&<p className="mt-2 text-slate-600">{form.description}</p>}<div className="mt-7"><PublicLeadForm slug={slug} fields={form.fields} consentText={form.consent_text} accentColor={form.accent_color}/></div><p className="mt-6 text-center text-xs text-slate-500">Do not submit Social Security numbers, banking information, or tax documents here.</p></section></main>;
}
