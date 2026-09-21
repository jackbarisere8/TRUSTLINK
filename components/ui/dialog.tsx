"use client";
import { useEffect, useRef } from "react";
export function Dialog({children,onClose,label}:{children:React.ReactNode;onClose:()=>void;label:string}) {
  const ref=useRef<HTMLDialogElement>(null);
  const closeRef=useRef(onClose);
  useEffect(()=>{closeRef.current=onClose;},[onClose]);
  useEffect(()=>{
    const dialog=ref.current; const previous=document.activeElement as HTMLElement|null;
    dialog?.showModal(); const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
    return ()=>{dialog?.close();document.body.style.overflow=overflow;previous?.focus();};
  },[]);
  return <dialog ref={ref} onCancel={()=>closeRef.current()} aria-label={label} className="p-0 bg-transparent max-w-[calc(100%-2rem)] w-[672px] rounded-xl backdrop:bg-navy-950/60">{children}</dialog>;
}
