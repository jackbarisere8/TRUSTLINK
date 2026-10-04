"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { acceptJobAction, jobCommandAction } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobStatus } from "@/lib/db/types";
import type { JobCommand } from "@/lib/validation";
import { isActionAvailable, type TransactionAction } from "@/lib/domain/transactions/policy";
import { money } from "@/lib/format";
export function JobActions({ jobId, publicId, status, version, actor, paymentAmount, paymentCurrency, revisionsUsed, revisionsIncluded, hasReview = false, hasActiveClientCapability = false, canRespondToDispute = false }: { jobId: string; publicId: string; status: JobStatus; version: number; actor: "PROVIDER" | "CLIENT_PARTICIPANT" | "ADMIN"; paymentAmount: string; paymentCurrency: string; revisionsUsed: number; revisionsIncluded: number; hasReview?: boolean; hasActiveClientCapability?: boolean; canRespondToDispute?: boolean }) {
  const operation = useRef<{payload:string;version:number;id:string} | null>(null);
  const [pending,start] = useTransition();
  const [message,setMessage] = useState("");
  const [mode,setMode] = useState("");
  const [files,setFiles] = useState<{path:string;name:string}[]>([]);
  const [uploading,setUploading] = useState(false);
  const [shareUrl,setShareUrl] = useState("");
  const router = useRouter();
  const provider = actor === "PROVIDER", client = actor === "CLIENT_PARTICIPANT";
  const revisionsRemaining = Math.max(0,revisionsIncluded-revisionsUsed);
  const can = (action: TransactionAction) => isActionAvailable(status, actor, action);
  async function requestUploadRemoval(file: {path:string;name:string}) {
    const response = await fetch("/api/evidence/" + jobId + "?path=" + encodeURIComponent(file.path),{method:"DELETE"});
    if (!response.ok) { const result = await response.json().catch(()=>({})); throw new Error(result.error || "Removal failed."); }
  }
  async function removeUpload(file: {path:string;name:string}) {
    setUploading(true);
    try { await requestUploadRemoval(file); setFiles(current => current.filter(candidate => candidate.path !== file.path)); setMessage("Attachment removed."); }
    catch(error) { setMessage(error instanceof Error ? error.message : "The attachment could not be removed."); }
    finally { setUploading(false); }
  }
  async function discardUploads() {
    if (!files.length) return true;
    setUploading(true);
    try {
      const results = await Promise.allSettled(files.map(requestUploadRemoval));
      const retained = files.filter((_,index) => results[index].status === "rejected");
      setFiles(retained);
      if (retained.length) { setMessage("Some pending attachments could not be removed. Try again before leaving this form."); return false; }
      return true;
    } finally { setUploading(false); }
  }
  async function openMode(nextMode: string) { if (nextMode !== mode && !(await discardUploads())) return; setMode(nextMode); }
  async function closeMode() { if (await discardUploads()) setMode(""); }
  function requestFor(input: unknown) {
    const payload = JSON.stringify(input);
    if (!operation.current || operation.current.payload !== payload || operation.current.version !== version) operation.current = { payload, version, id: crypto.randomUUID() };
    return operation.current.id;
  }
  function run(command: JobCommand) {
    const requestId = requestFor(command);
    start(async () => {
      try {
        const result = await jobCommandAction(jobId,command,version,requestId);
        if (!result.success) setMessage(result.error);
        else { setMessage(result.replayed && command.type === "ROTATE_INVITE" ? "This link replacement was already recorded. If you lost the new link, replace it again to get a fresh one." : "Your change has been recorded."); if (result.replayed) operation.current = null; setMode(""); setFiles([]); if (result.clientShareUrl) setShareUrl(window.location.origin + result.clientShareUrl); router.refresh(); }
      } catch { setMessage("Connection interrupted. Refresh the record before trying again."); }
    });
  }
  async function upload(purpose: "DELIVERY" | "DISPUTE", file?: File) {
    if (!file) return;
    if (file.size > 10*1024*1024 || files.length >= 10) { setMessage("Choose up to 10 files, no larger than 10 MB each."); return; }
    setUploading(true);
    try {
      const form = new FormData(); form.set("purpose",purpose); form.set("file",file);
      const response = await fetch("/api/evidence/" + jobId,{method:"POST",body:form});
      const result = await response.json();
      if (!response.ok) setMessage(result.error || "Upload failed.");
      else setFiles(prev => [...prev,result]);
    } catch { setMessage("Upload interrupted. Please try again."); }
    finally { setUploading(false); }
  }
  return <section className="mt-8 pt-8 border-t border-surface-200" aria-label="Transaction actions">
    <h2 className="text-base font-semibold mb-3">{provider ? "Provider actions" : client ? "Your next step" : "Dispute resolution"}</h2>
    {message && <p role="status" className="notice mb-4">{message}</p>}
    {shareUrl && <div className="mb-5 space-y-2"><Input label="Private client link" value={shareUrl} readOnly onFocus={e=>e.target.select()}/><p className="text-xs text-surface-500">Share only with your client. This replaces the previous link and expires in 30 days.</p><Button variant="outline" onClick={async()=>{try {await navigator.clipboard.writeText(shareUrl);setMessage("Client link copied.");}catch{setMessage("Select and copy the client link above.");}}}>Copy client link</Button></div>}
    <div className="flex flex-wrap gap-3">
      {can("ACCEPT") && <Button onClick={()=>void openMode("ACCEPT")}>Review & accept terms</Button>}
      {can("PAYMENT") && <Button disabled={pending} onClick={()=>void openMode("PAYMENT")}>Record payment received</Button>}
      {can("START") && <Button disabled={pending} onClick={()=>run({type:"START"})}>{status === "REVISION_REQUESTED" ? "Start revision" : "Start work"}</Button>}
      {can("DELIVER") && <Button onClick={()=>void openMode("DELIVER")}>Submit delivery</Button>}
      {can("APPROVE") && <Button disabled={pending} onClick={()=>void openMode("APPROVE")}>Approve delivery</Button>}
      {can("REVISE") && revisionsRemaining > 0 && <Button variant="outline" onClick={()=>void openMode("REVISE")}>Request revision</Button>}
      {can("COMPLETE") && <Button disabled={pending} onClick={()=>run({type:"COMPLETE"})}>Complete transaction</Button>}
      {can("REVIEW") && !hasReview && <Button onClick={()=>void openMode("REVIEW")}>Leave a review</Button>}
      {can("DISPUTE") && <Button variant="outline" onClick={()=>void openMode("DISPUTE")}>Open transaction dispute</Button>}
      {can("RESPOND_DISPUTE") && canRespondToDispute && <Button variant="outline" onClick={()=>void openMode("RESPOND_DISPUTE")}>Respond to dispute</Button>}
      {can("RESOLVE") && <Button onClick={()=>void openMode("RESOLVE")}>Resolve dispute</Button>}
      {can("ROTATE_INVITE") && <Button variant="outline" disabled={pending} onClick={()=>void openMode("ROTATE_INVITE")}>Replace client link</Button>}
      {can("REVOKE_INVITE") && hasActiveClientCapability && <Button variant="ghost" disabled={pending} onClick={()=>void openMode("REVOKE_INVITE")}>Revoke client access</Button>}
      {can("CANCEL") && <Button variant="ghost" onClick={()=>void openMode("CANCEL")}>Cancel record</Button>}
    </div>
    {client && can("REVISE") && revisionsRemaining === 0 && <p className="text-sm text-surface-500 mt-4">The included revision limit has been reached. You can approve the delivery or open a dispute.</p>}
    {client && ["ACCEPTED","PAYMENT_RECORDED","IN_PROGRESS","APPROVED"].includes(status) && <p className="text-sm text-surface-500 mt-4">{status === "APPROVED" ? "Delivery approved. The provider can now close the transaction." : "The provider has the next step. Return here to review delivery."}</p>}
    {status === "DISPUTED" && actor !== "ADMIN" && <p className="text-sm text-surface-600 mt-4">The dispute is recorded and work is paused. An administrator must review it before the transaction can resume.</p>}
    {mode && <form className="mt-6 space-y-4 border-t border-surface-200 pt-6" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      if (mode === "ACCEPT") { const details = {name:f.get("name"),email:f.get("email"),confirmed:f.get("confirmed")==="on"}; const requestId = requestFor({type:"ACCEPT",...details}); start(async()=>{ try { const r = await acceptJobAction(publicId,details,version,requestId); if(!r.success)setMessage(r.error);else{setMessage("Agreement accepted.");setMode("");router.refresh();} }catch{setMessage("We couldn't confirm acceptance. Refresh and try again.");} }); return; }
      const description = String(f.get("description") || "");
      if (mode==="PAYMENT") run({type:"PAYMENT",reference:String(f.get("reference")||"").trim()||undefined,notes:description.trim()||undefined});
      if (mode==="DELIVER") run({type:"DELIVER",description,files:files.map(f=>f.path)});
      if (mode==="REVISE") run({type:"REVISE",description});
      if (mode==="DISPUTE") run({type:"DISPUTE",description,files:files.map(f=>f.path),contestedTerm:f.get("term") as "Scope"});
      if (mode==="RESPOND_DISPUTE") run({type:"RESPOND_DISPUTE",response:description});
      if (mode==="REVIEW") run({type:"REVIEW",rating:Number(f.get("rating")),comment:description});
      if (mode==="RESOLVE") run({type:"RESOLVE",notes:description,outcome:f.get("outcome") as "IN_PROGRESS" | "CANCELLED"});
      if (mode==="APPROVE") run({type:"APPROVE"});
      if (mode==="CANCEL") run({type:"CANCEL"});
      if (mode==="ROTATE_INVITE") run({type:"ROTATE_INVITE"});
      if (mode==="REVOKE_INVITE") run({type:"REVOKE_INVITE"});
    }}>
      {mode==="ACCEPT" && <><Input label="Your name or organization" name="name" autoComplete="name" required maxLength={120}/><Input label="Your email" name="email" type="email" autoComplete="email" required/><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" required className="mt-1 h-5 w-5"/>I have read and accept the scope, fee, deadline, revisions and cancellation terms. My details are self-provided.</label></>}
      {mode==="PAYMENT" && <><div className="notice"><p className="text-xs font-semibold text-surface-600">Agreed amount to record</p><p className="mt-1 text-lg font-semibold tabular-nums">{money(paymentAmount,paymentCurrency)}</p></div><p className="text-sm text-surface-600">Confirm only after you received this amount directly. TrustLink does not process or independently verify the transfer.</p><Input name="reference" label="Transfer reference (optional)" maxLength={200}/></>}
      {mode==="REVISE" && <p className="text-sm text-surface-500">{revisionsRemaining} of {revisionsIncluded} included revision{revisionsIncluded === 1 ? "" : "s"} remaining.</p>}
      {mode==="DISPUTE" && <label className="field-label">Contested term<select name="term" className="field mt-2">{["Scope","Quality","Deadline","Payment","Communication"].map(t=><option key={t}>{t}</option>)}</select></label>}
      {mode==="REVIEW" && <label className="field-label">Client rating<select name="rating" className="field mt-2" defaultValue="" required><option value="" disabled>Choose a rating</option>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>}
      {mode==="RESOLVE" && <><label className="field-label">Outcome<select className="field mt-2" name="outcome"><option value="IN_PROGRESS">Resume agreed work</option><option value="CANCELLED">Cancel transaction record</option></select></label><p className="text-xs leading-6 text-surface-500">Resolution records an operational decision. TrustLink does not hold funds, reverse transfers, or issue refunds.</p></>}
      {["DELIVER","REVISE","DISPUTE","RESPOND_DISPUTE","RESOLVE","REVIEW","PAYMENT"].includes(mode) && <label className="field-label">{mode==="DELIVER" ? "Describe your delivery" : mode==="REVISE" ? "What needs revision?" : mode==="RESPOND_DISPUTE" ? "Your response" : mode==="RESOLVE" ? "Resolution notes" : "Details"}<textarea className="field mt-2 min-h-28" name="description" required={!["PAYMENT","REVIEW"].includes(mode)} maxLength={mode==="PAYMENT" ? 2000 : mode==="REVIEW" ? 3000 : 5000}/></label>}
      {["DELIVER","DISPUTE"].includes(mode) && <div className="space-y-2"><label className="field-label">Private attachments (optional)<input type="file" className="block w-full text-sm mt-2" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" disabled={uploading || pending} onChange={e=>{upload(mode === "DELIVER" ? "DELIVERY" : "DISPUTE",e.target.files?.[0]);e.target.value="";}}/></label><p className="text-xs text-surface-500">PDF, images or plain text. Up to 10 MB per file. Visible to participants and administrators after submission.</p>{uploading && <p role="status">Updating private attachments…</p>}{files.map(file=><div key={file.path} className="flex items-center justify-between gap-3"><p className="text-sm break-all">{file.name}</p><Button type="button" variant="ghost" size="sm" disabled={uploading || pending} onClick={()=>void removeUpload(file)}>Remove</Button></div>)}</div>}
      {mode==="APPROVE" && <p className="text-sm">Confirm that the submitted delivery meets the agreed scope. The provider can then complete the transaction.</p>}
      {mode==="CANCEL" && <p className="text-sm">Cancel this unaccepted record? Its history will remain, and the client will no longer be able to accept it.</p>}
      {mode==="ROTATE_INVITE" && <p className="text-sm">Create a replacement link for the same client. The previous link and existing client access will stop working.</p>}
      {mode==="REVOKE_INVITE" && <p className="text-sm">Revoke this client&apos;s participant access. Their current link and browser access will stop working until you issue a replacement link.</p>}
      <div className="flex gap-3"><Button type="submit" loading={pending || uploading}>{mode === "ACCEPT" ? "Confirm acceptance" : mode === "PAYMENT" ? "Confirm payment received" : "Confirm change"}</Button><Button type="button" variant="ghost" disabled={pending || uploading} onClick={()=>void closeMode()}>Back</Button></div>
    </form>}
  </section>;
}
