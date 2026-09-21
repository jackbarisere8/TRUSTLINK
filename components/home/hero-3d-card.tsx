"use client";
import { useRef } from "react";
import { TransactionRecord } from "@/components/jobs/transaction-record";
import { exampleRecord } from "@/lib/examples";
export function Hero3DCard() {
  const ref=useRef<HTMLDivElement>(null);
  return <div style={{perspective:1200}} onPointerMove={e=>{
    if(e.pointerType!=="mouse"||window.matchMedia("(prefers-reduced-motion: reduce)").matches||!ref.current)return;
    const r=e.currentTarget.getBoundingClientRect();
    ref.current.style.transform="rotateX("+(-(e.clientY-r.top-r.height/2)/r.height*2)+"deg) rotateY("+((e.clientX-r.left-r.width/2)/r.width*2)+"deg)";
  }} onPointerLeave={()=>{if(ref.current)ref.current.style.transform="none";}}>
    <div ref={ref} className="hero-record transition-transform duration-200"><TransactionRecord record={exampleRecord} compact example/></div>
  </div>;
}
