"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { acceptJobAction, jobCommandAction } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobStatus } from "@/lib/db/types";
import type { JobCommand } from "@/lib/validation";
import { isActionAvailable, type TransactionAction } from "@/lib/domain/transactions/policy";
export function JobActions({ jobId, publicId, status, version, actor, hasReview = false }: { jobId: string; publicId: string; status: JobStatus; version: number; actor: "PROVIDER" | "CLIENT_PARTICIPANT" | "ADMIN"; hasReview?: boolean }) {
  const operation = useRef<{payload:string;version:number;id:string} | null>(null);
  const [pending,start] = useTransition();
  const [message,setMessage] = useState("");
  const [mode,setMode] = useState("");
  const [files,setFiles] = useState<{path:string;name:string}[]>([]);
  const [uploading,setUploading] = useState(false);
  const [shareUrl,setShareUrl] = useState("");
  const router = useRouter();
  const provider = actor === "PROVIDER", client = actor === "CLIENT_PARTICIPANT";
  const can = (action: TransactionAction) => isActionAvailable(status, actor, action);
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
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 10*1024*1024 || files.length >= 10) { setMessage("Choose up to 10 files, no larger than 10 MB each."); return; }
    setUploading(true);
    try {
      const form = new FormData(); form.set("file",file);
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
      {can("ACCEPT") && <Button onClick={()=>setMode("ACCEPT")}>Review & accept terms</Button>}
      {can("PAYMENT") && <Button onClick={()=>setMode("PAYMENT")}>Record payment</Button>}
      {can("START") && <Button disabled={pending} onClick={()=>run({type:"START"})}>{status === "REVISION_REQUESTED" ? "Start revision" : "Start work"}</Button>}
      {can("DELIVER") && <Button onClick={()=>setMode("DELIVER")}>Submit delivery</Button>}
      {can("APPROVE") && <Button disabled={pending} onClick={()=>setMode("APPROVE")}>Approve delivery</Button>}
      {can("REVISE") && <Button variant="outline" onClick={()=>setMode("REVISE")}>Request revision</Button>}
      {can("COMPLETE") && <Button disabled={pending} onClick={()=>run({type:"COMPLETE"})}>Complete transaction</Button>}
      {can("REVIEW") && !hasReview && <Button onClick={()=>setMode("REVIEW")}>Leave a review</Button>}
      {can("DISPUTE") && <Button variant="outline" onClick={()=>setMode("DISPUTE")}>Open transaction dispute</Button>}
      {can("RESOLVE") && <Button onClick={()=>setMode("RESOLVE")}>Resolve dispute</Button>}
      {can("ROTATE_INVITE") && <Button variant="outline" disabled={pending} onClick={()=>setMode("ROTATE_INVITE")}>Replace client link</Button>}
      {can("CANCEL") && <Button variant="ghost" onClick={()=>setMode("CANCEL")}>Cancel record</Button>}
    </div>
    {client && ["ACCEPTED","PAYMENT_RECORDED","IN_PROGRESS","APPROVED"].includes(status) && <p className="text-sm text-surface-500 mt-4">{status === "APPROVED" ? "Delivery approved. The provider can now close the transaction." : "The provider has the next step. Return here to review delivery."}</p>}
    {status === "DISPUTED" && actor !== "ADMIN" && <p className="text-sm text-surface-600 mt-4">The dispute is recorded and work is paused. An administrator must review it before the transaction can resume.</p>}
    {mode && <form className="mt-6 space-y-4 border-t border-surface-200 pt-6" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      if (mode === "ACCEPT") { const details = {name:f.get("name"),email:f.get("email"),confirmed:f.get("confirmed")==="on"}; const requestId = requestFor({type:"ACCEPT",...details}); start(async()=>{ try { const r = await acceptJobAction(publicId,details,version,requestId); if(!r.success)setMessage(r.error);else{setMessage("Agreement accepted.");setMode("");router.refresh();} }catch{setMessage("We couldn't confirm acceptance. Refresh and try again.");} }); return; }
      const description = String(f.get("description") || "");
      if (mode==="PAYMENT") run({type:"PAYMENT",reference:String(f.get("reference")||""),notes:description});
      if (mode==="DELIVER") run({type:"DELIVER",description,files:files.map(f=>f.path)});
      if (mode==="REVISE") run({type:"REVISE",description});
      if (mode==="DISPUTE") run({type:"DISPUTE",description,files:files.map(f=>f.path),contestedTerm:f.get("term") as "Scope"});
      if (mode==="REVIEW") run({type:"REVIEW",rating:Number(f.get("rating")),comment:description});
      if (mode==="RESOLVE") run({type:"RESOLVE",notes:description,outcome:f.get("outcome") as "IN_PROGRESS" | "CANCELLED"});
      if (mode==="APPROVE") run({type:"APPROVE"});
      if (mode==="CANCEL") run({type:"CANCEL"});
      if (mode==="ROTATE_INVITE") run({type:"ROTATE_INVITE"});
    }}>
      {mode==="ACCEPT" && <><Input label="Your name or organization" name="name" autoComplete="name" required maxLength={120}/><Input label="Your email" name="email" type="email" autoComplete="email" required/><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirmed" required className="mt-1 h-5 w-5"/>I have read and accept the scope, fee, deadline, revisions and cancellation terms. My details are self-provided.</label></>}
      {mode==="PAYMENT" && <><p className="text-sm text-surface-600">Record only a payment you received directly. TrustLink does not process or independently verify the transfer.</p><Input name="reference" label="Transfer reference (optional)" maxLength={200}/></>}
      {mode==="DISPUTE" && <label className="field-label">Contested term<select name="term" className="field mt-2">{["Scope","Quality","Deadline","Payment","Communication"].map(t=><option key={t}>{t}</option>)}</select></label>}
      {mode==="REVIEW" && <label className="field-label">Client rating<select name="rating" className="field mt-2" defaultValue="" required><option value="" disabled>Choose a rating</option>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>}
      {mode==="RESOLVE" && <label className="field-label">Outcome<select className="field mt-2" name="outcome"><option value="IN_PROGRESS">Resume work</option><option value="CANCELLED">Cancel transaction</option></select></label>}
      {["DELIVER","REVISE","DISPUTE","RESOLVE","REVIEW","PAYMENT"].includes(mode) && <label className="field-label">{mode==="DELIVER" ? "Describe your delivery" : mode==="REVISE" ? "What needs revision?" : "Details"}<textarea className="field mt-2 min-h-28" name="description" required={!["PAYMENT","REVIEW"].includes(mode)} maxLength={mode==="REVIEW" ? 3000 : 5000}/></label>}
      {["DELIVER","DISPUTE"].includes(mode) && <div className="space-y-2"><label className="field-label">Private attachments (optional)<input type="file" className="block w-full text-sm mt-2" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" disabled={uploading || pending} onChange={e=>{upload(e.target.files?.[0]);e.target.value="";}}/></label><p className="text-xs text-surface-500">PDF, images or plain text. Up to 10 MB per file. Visible to participants and administrators.</p>{uploading && <p role="status">Uploading…</p>}{files.map(f=><p key={f.path} className="text-sm">{f.name}</p>)}</div>}
      {mode==="APPROVE" && <p className="text-sm">Confirm that the submitted delivery meets the agreed scope. The provider can then complete the transaction.</p>}
      {mode==="CANCEL" && <p className="text-sm">Cancel this unaccepted record? Its history will remain, and the client will no longer be able to accept it.</p>}
      {mode==="ROTATE_INVITE" && <p className="text-sm">Create a replacement link for the same client. The previous link and existing client access will stop working.</p>}
      <div className="flex gap-3"><Button type="submit" loading={pending || uploading}>Confirm {mode === "ACCEPT" ? "acceptance" : "change"}</Button><Button type="button" variant="ghost" disabled={pending} onClick={()=>setMode("")}>Back</Button></div>
    </form>}
  </section>;
}
