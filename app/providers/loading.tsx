import { Footer } from "@/components/navigation/footer";
import { Navbar } from "@/components/navigation/navbar";

export default function ProvidersLoading(){return <><Navbar/><main id="main-content" className="min-h-[70vh] bg-surface-50" aria-busy="true"><div className="shell py-12"><p className="eyebrow">TrustLink marketplace</p><h1 className="interface-heading mt-3 text-4xl">Finding published providers…</h1><div className="mt-10 grid gap-7 md:grid-cols-[17rem_1fr]"><div className="h-96 animate-pulse rounded bg-surface-200"/><div className="space-y-4">{[1,2,3].map(item=><div key={item} className="h-52 animate-pulse rounded bg-white"/>)}</div></div></div></main><Footer/></>}
