"use client";
import { useState, useTransition, useRef } from "react";
import Link from "next/link";
import { createJobAction } from "@/app/actions/jobs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sourceChannels } from "@/lib/validation";
import { TransactionRecord } from "./transaction-record";
import type { PublicJobProjection } from "@/lib/db/types";
export function CreateJobForm({provider,location,repeat}:{provider:PublicJobProjection["provider"];location:string;repeat:boolean}) {
  const creationId = useRef("");
  const [preview,setPreview] = useState<Record<string,FormDataEntryValue>|null>(null);
  const [pending,start] = useTransition(); const [error,setError] = useState("");
  const [result,setResult] = useState<{clientShareUrl?:string;publicUrl:string;jobId:string}|null>(null);
  const [copied,setCopied] = useState(false);
  const input = preview ? {title:String(preview.title),category:String(preview.category),scope:String(preview.scope),deliverables:String(preview.deliverables).split("\n").map(s=>s.trim()).filter(Boolean),price:String(preview.price),deadline:String(preview.deadline),revisions:Number(preview.revisions),cancellationTerms:String(preview.cancellationTerms),sourceChannel:String(preview.sourceChannel),repeatUse:String(preview.repeatUse||"FIRST"),confirmed:true} : null;
  if (result && !result.clientShareUrl) return <div className="space-y-4"><h2 className="text-xl font-semibold">This transaction was already created</h2><p className="text-sm">Open its workspace to replace the private client link if the original response was interrupted.</p><Button href={"/dashboard/jobs/"+result.jobId}>Open workspace</Button></div>;
  if (result) return <div className="space-y-5"><h2 className="text-xl font-semibold">Your transaction record is ready</h2><p className="text-sm text-surface-600">Share the private client link only with your intended client. Anyone holding it can act as the client. It expires in 30 days.</p><Input label="Private client link" value={window.location.origin+result.clientShareUrl} readOnly onFocus={e=>e.target.select()}/><div className="flex flex-wrap gap-3"><Button onClick={async()=>{try{await navigator.clipboard.writeText(window.location.origin+result.clientShareUrl);setCopied(true);}catch{setError("Select and copy the link above.");}}}>{copied?"Copied":"Copy client link"}</Button><Button href={"/dashboard/jobs/"+result.jobId} variant="outline">Open workspace</Button></div><Link href={result.publicUrl} className="text-sm underline block">View public agreement</Link>{error&&<p role="status">{error}</p>}</div>;
  return <>{error&&<p role="alert" className="notice mb-5">{error}</p>}<form className={preview?"hidden":"space-y-5"} onSubmit={e=>{e.preventDefault();setError("");setPreview(Object.fromEntries(new FormData(e.currentTarget)));}}>
    <Input label="Service title" name="title" placeholder="Brand website refresh" required maxLength={160}/>
    <Input label="Service category" name="category" placeholder="Web design" required maxLength={100}/>
    <label className="field-label">Agreed scope<textarea className="field mt-2 min-h-28" name="scope" required maxLength={10000}/></label>
    <label className="field-label">Deliverables, one per line<textarea className="field mt-2 min-h-28" name="deliverables" required maxLength={15000}/></label>
    <div className="grid sm:grid-cols-2 gap-5"><Input label="Fee (NGN)" name="price" type="number" min="0.01" max="999999999" step="0.01" required/><Input label="Deadline" name="deadline" type="date" required/></div>
    <Input label="Included revision rounds" name="revisions" type="number" min="0" max="20" defaultValue="2" required/>
    <label className="field-label">Cancellation terms<textarea className="field mt-2 min-h-28" name="cancellationTerms" required maxLength={3000} placeholder="Describe what happens if either party needs to cancel. Payments and refunds are arranged directly between the parties."/></label>
    <label className="field-label">Where did this agreement start?<select className="field mt-2" name="sourceChannel">{sourceChannels.map(s=><option key={s}>{s}</option>)}</select></label>
    {repeat&&<fieldset><legend className="field-label">What brought you back to TrustLink?</legend><label className="flex items-center gap-3 py-3 text-sm"><input required type="radio" name="repeatUse" value="UNPROMPTED"/>I chose to use it again</label><label className="flex items-center gap-3 py-3 text-sm"><input required type="radio" name="repeatUse" value="PROMPTED"/>Someone reminded or asked me to use it</label></fieldset>}
    <p className="notice">Your service terms and provider details will be visible to anyone with the public link. Contact details, attachments and dispute evidence remain private.</p>
    <Button type="submit">Preview agreement</Button>
  </form>
  {preview&&input&&<div className="space-y-5"><TransactionRecord headingLevel={2} record={{publicId:"Unpublished preview",status:"SENT",sourceChannel:input.sourceChannel as PublicJobProjection["sourceChannel"],providerLocation:location,createdAt:new Date().toISOString(),service:input.title,serviceCategory:input.category,scope:input.scope,deliverables:input.deliverables,price:input.price,currency:"NGN",deadline:input.deadline,revisionsIncluded:input.revisions,revisionsUsed:0,cancellationTerms:input.cancellationTerms,provider}}/>
    <form className="space-y-4" onSubmit={e=>{e.preventDefault();start(async()=>{try{if(!creationId.current) creationId.current=crypto.randomUUID(); const r=await createJobAction({...input,creationId:creationId.current});if(r.success)setResult(r);else setError(r.error);}catch{setError("We couldn't publish the record. Please try again.");}});}}>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" required className="h-5 w-5"/>I confirm these terms are accurate and may be shared through this public link.</label>
      <div className="flex gap-3"><Button type="submit" loading={pending}>Publish & create client link</Button><Button type="button" variant="outline" disabled={pending} onClick={()=>setPreview(null)}>Edit terms</Button></div>
    </form></div>}
  </>;
}
