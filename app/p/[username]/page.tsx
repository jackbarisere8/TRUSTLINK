import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { getProviderReputation } from "@/lib/reputation";
import { dateLabel, money } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {title:"Trust Profile",description:"Transaction history from completed TrustLink records."};
export default async function Page({params}:{params:Promise<{username:string}>}) {
  const {username}=await params; const example=username==="amaka";
  const data=example?null:await getProviderReputation(username);
  if(!example&&!data)notFound();
  const name=example?"Amaka Okafor":data!.profile.displayName, headline=example?"Web designer & frontend developer":data?.providerProfile?.headline||"Independent professional";
  const jobs=example?[{publicId:"sample-website-project",title:"Brand website refresh",price:"180000",completedAt:"2026-10-18"}]:data!.jobs;
  return <><Navbar/><main id="main-content" className="shell max-w-4xl py-12 sm:py-20">
    {example&&<p className="notice mb-8">Example Trust Profile · The person, transactions and performance figures below are illustrative.</p>}
    <p className="field-label mb-4">Trust Profile</p><h1 className="text-3xl sm:text-4xl font-semibold">{name}</h1><p className="mt-3 text-surface-600">{headline}</p><p className="text-sm text-surface-500 mt-2">{example?"Lagos, Nigeria":[data?.profile.city,data?.profile.country].filter(Boolean).join(", ")}</p>
    <p className="text-xs text-surface-500 mt-5">Provider details are self-provided. A transaction history does not independently verify identity.</p>
    {data?.providerProfile?.bio&&<p className="text-sm leading-7 max-w-2xl mt-6">{data.providerProfile.bio}</p>}
    <dl className="grid grid-cols-3 gap-4 border-y border-surface-200 py-8 my-10">{[[example?"1":data!.completedJobsCount,"Completed transactions"],[example?"—":data!.averageRating,"Average client rating"],[example?"—":data!.onTimeRate,"Delivered by deadline"]].map(([v,k])=><div key={k}><dd className="text-2xl sm:text-3xl font-semibold tabular-nums">{v}</dd><dt className="text-xs sm:text-sm text-surface-500 mt-2">{k}</dt></div>)}</dl>
    <h2 className="text-lg font-semibold mb-3">Transaction history</h2><p className="text-sm text-surface-500 mb-6">Completed records and client feedback. A dash means there is not enough recorded evidence.</p>
    {!jobs.length?<p className="py-10 text-sm border-y">No completed transactions yet. History will appear here after work is approved and completed.</p>:<div className="divide-y border-y">{jobs.map(j=><div key={j.publicId} className="py-6 flex flex-wrap justify-between gap-4"><div><Link href={"/j/"+j.publicId} className="font-medium hover:underline">{j.title}</Link><p className="text-xs text-surface-500 mt-2">{example?"Illustrative completion": "Completed"} · {dateLabel(j.completedAt)}</p></div><p className="text-sm tabular-nums">{money(j.price)}</p></div>)}</div>}
    {!example&&<p className="text-xs leading-6 text-surface-500 mt-6">Completion counts come from completed records. Ratings use submitted client reviews. On-time delivery compares the final submitted delivery date with the agreed deadline.</p>}
  </main><Footer/></>;
}
