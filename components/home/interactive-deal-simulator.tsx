"use client";
import { useState } from "react";
import { TransactionRecord } from "@/components/jobs/transaction-record";
import { exampleRecord } from "@/lib/examples";
import { Input } from "@/components/ui/input";
export function InteractiveDealSimulator() {
  const [record,setRecord]=useState(exampleRecord);
  return <section className="section bg-surface-50 border-b border-surface-200" id="preview"><div className="shell grid lg:grid-cols-[.85fr_1.15fr] gap-10 lg:gap-20 items-start">
    <div><p className="eyebrow">Try the record</p><h2 className="text-3xl sm:text-4xl mt-4 mb-5">A few clear terms.<br/>One shared understanding.</h2><p className="text-sm text-surface-600 leading-7 mb-8">Edit this example to see how your agreement will look. Nothing here is saved or published.</p>
      <div className="space-y-5"><Input label="Service" value={record.service} maxLength={160} onChange={e=>setRecord({...record,service:e.target.value})}/><label className="field-label">Scope<textarea className="field mt-2 min-h-28" value={record.scope} maxLength={500} onChange={e=>setRecord({...record,scope:e.target.value})}/></label><div className="grid sm:grid-cols-2 gap-4"><Input label="Fee (NGN)" type="number" min="1" value={record.price} onChange={e=>setRecord({...record,price:e.target.value})}/><Input label="Deadline" type="date" value={record.deadline} onChange={e=>setRecord({...record,deadline:e.target.value})}/></div><Input label="Revision rounds" type="number" min="0" max="20" value={record.revisionsIncluded} onChange={e=>setRecord({...record,revisionsIncluded:Math.max(0,Math.min(20,Number(e.target.value)))})}/></div>
    </div><div><p className="text-xs text-surface-500 mb-4">Live example preview</p><TransactionRecord record={record} compact example/></div>
  </div></section>;
}
