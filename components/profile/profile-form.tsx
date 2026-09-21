"use client";
import { useState, useTransition } from "react";
import type { ProfileInput } from "@/lib/db/repository";
import { updateProfileAction } from "@/app/actions/profile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function ProfileForm({initial}:{initial:ProfileInput}) {
  const [message,setMessage] = useState("");const [pending,start] = useTransition();
  return <form className="space-y-5 max-w-xl" onSubmit={e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.currentTarget));start(async()=>{try{const r=await updateProfileAction(data);setMessage(r.error||r.message||"");}catch{setMessage("Connection interrupted. Please try again.");}});}}>
    {Object.entries({displayName:"Name or business name",headline:"Professional headline",country:"Country",state:"State / region",city:"City",serviceArea:"Service area"}).map(([name,label])=><Input key={name} name={name} label={label} defaultValue={initial[name as keyof ProfileInput]} required={!["state","city"].includes(name)} maxLength={160}/>)}
    <label className="field-label">About your work<textarea className="field mt-2 min-h-32" name="bio" defaultValue={initial.bio} maxLength={2000}/></label>
    {message && <p role="status" className="notice">{message}</p>}<Button type="submit" loading={pending}>Save profile</Button>
  </form>;
}
