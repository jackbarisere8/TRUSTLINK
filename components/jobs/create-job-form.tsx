"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { createJobAction } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createJobDraftSchema, sourceChannels, type CreateJobDraft } from "@/lib/validation";
import type { PublicJobProjection } from "@/lib/db/types";
import { TransactionRecord } from "./transaction-record";

type CreationResult = { clientShareUrl?: string; publicUrl: string; jobId: string };

function draftFromForm(form: HTMLFormElement) {
  const data = new FormData(form);
  return {
    title: String(data.get("title") || ""),
    category: String(data.get("category") || ""),
    scope: String(data.get("scope") || ""),
    deliverables: String(data.get("deliverables") || "").split("\n").map(value => value.trim()).filter(Boolean),
    price: String(data.get("price") || ""),
    deadline: String(data.get("deadline") || ""),
    revisions: Number(data.get("revisions")),
    cancellationTerms: String(data.get("cancellationTerms") || ""),
    sourceChannel: String(data.get("sourceChannel") || ""),
    repeatUse: String(data.get("repeatUse") || "FIRST"),
  };
}

export function CreateJobForm({provider,location,repeat}:{provider:PublicJobProjection["provider"];location:string;repeat:boolean}) {
  const creationId = useRef("");
  const [preview,setPreview] = useState<CreateJobDraft | null>(null);
  const [pending,start] = useTransition();
  const [error,setError] = useState("");
  const [result,setResult] = useState<CreationResult | null>(null);
  const [copied,setCopied] = useState(false);

  if (result && !result.clientShareUrl) return <div className="space-y-4"><h2 className="text-xl font-semibold">This transaction was already created</h2><p className="text-sm">Open its workspace to replace the private client link if the original response was interrupted.</p><Button href={"/dashboard/jobs/"+result.jobId}>Open workspace</Button></div>;
  if (result) return <div className="space-y-5"><h2 className="text-xl font-semibold">Your transaction record is ready</h2><p className="text-sm text-surface-600">Share the private client link only with your intended client. Anyone holding it can act as the client. It expires in 30 days.</p><Input label="Private client link" value={window.location.origin+result.clientShareUrl} readOnly onFocus={event=>event.target.select()}/><div className="flex flex-wrap gap-3"><Button onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+result.clientShareUrl);setCopied(true);}catch{setError("Select and copy the link above.");}}}>{copied?"Copied":"Copy client link"}</Button><Button href={"/dashboard/jobs/"+result.jobId} variant="outline">Open workspace</Button></div><Link href={result.publicUrl} className="text-sm underline block">View public agreement</Link>{error&&<p role="status">{error}</p>}</div>;

  return <>
    {error&&<p role="alert" className="notice mb-5">{error}</p>}
    <form className={preview?"hidden":"space-y-5"} onSubmit={event=>{
      event.preventDefault();
      const parsed = createJobDraftSchema.safeParse(draftFromForm(event.currentTarget));
      if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Check every field and try again."); return; }
      setError(""); setPreview(parsed.data);
    }}>
      <Input label="Service title" name="title" placeholder="Brand website refresh" required maxLength={160}/>
      <Input label="Service category" name="category" placeholder="Web design" required maxLength={100}/>
      <label className="field-label">Agreed scope<textarea className="field mt-2 min-h-28" name="scope" required maxLength={10000}/></label>
      <label className="field-label">Deliverables, one per line<textarea className="field mt-2 min-h-28" name="deliverables" required maxLength={15000}/></label>
      <div className="grid sm:grid-cols-2 gap-5"><Input label="Fee (NGN)" name="price" type="number" min="0.01" max="999999999" step="0.01" required/><Input label="Deadline" name="deadline" type="date" required/></div>
      <Input label="Included revision rounds" name="revisions" type="number" min="0" max="20" defaultValue="2" required/>
      <label className="field-label">Cancellation terms<textarea className="field mt-2 min-h-28" name="cancellationTerms" required maxLength={3000} placeholder="Describe what happens if either party needs to cancel. Payments and refunds are arranged directly between the parties."/></label>
      <label className="field-label">Where did this agreement start?<select className="field mt-2" name="sourceChannel">{sourceChannels.map(source=><option key={source}>{source}</option>)}</select></label>
      {repeat&&<fieldset><legend className="field-label">What brought you back to TrustLink?</legend><label className="flex items-center gap-3 py-3 text-sm"><input required type="radio" name="repeatUse" value="UNPROMPTED"/>I chose to use it again</label><label className="flex items-center gap-3 py-3 text-sm"><input required type="radio" name="repeatUse" value="PROMPTED"/>Someone reminded or asked me to use it</label></fieldset>}
      <p className="notice">Your service terms and provider details will be visible to anyone with the public link. Contact details, attachments and dispute evidence remain private.</p>
      <Button type="submit">Preview agreement</Button>
    </form>
    {preview&&<div className="space-y-5"><TransactionRecord preview headingLevel={2} record={{status:"SENT",providerLocation:location,service:preview.title,scope:preview.scope,deliverables:preview.deliverables,price:preview.price,currency:"NGN",deadline:preview.deadline,revisionsIncluded:preview.revisions,revisionsUsed:0,cancellationTerms:preview.cancellationTerms,provider}}/>
      <form className="space-y-4" onSubmit={event=>{
        event.preventDefault();
        const confirmed = new FormData(event.currentTarget).get("confirmed") === "on";
        start(async()=>{try{
          if(!creationId.current) creationId.current=crypto.randomUUID();
          const response=await createJobAction({...preview,confirmed,creationId:creationId.current});
          if(response.success)setResult(response);else setError(response.error);
        }catch{setError("We couldn't publish the record. Please try again.");}});
      }}>
        <label className="flex items-start gap-3 text-sm"><input name="confirmed" type="checkbox" required className="h-5 w-5"/>I confirm these terms are accurate and may be shared through this public link.</label>
        <div className="flex gap-3"><Button type="submit" loading={pending}>Publish & create client link</Button><Button type="button" variant="outline" disabled={pending} onClick={()=>{setError("");setPreview(null);}}>Edit terms</Button></div>
      </form></div>}
  </>;
}
