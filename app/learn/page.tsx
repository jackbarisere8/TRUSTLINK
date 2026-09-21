import { Suspense } from "react";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { LearnView } from "@/components/learn/learn-view";
export const metadata={title:"Learning & practice",description:"Use a project outline to decide what to practise next."};
export default function Page(){return <><Navbar/><main id="main-content" className="pb-16"><header className="shell pt-12 pb-10 border-b"><p className="eyebrow">Explore · Pilot</p><h1 className="text-3xl sm:text-4xl mt-4 mb-5">Learning & practice</h1><p className="text-surface-600 max-w-2xl">Use a project outline to decide what to practise next.</p><p className="text-xs leading-6 text-surface-500 mt-5 max-w-2xl">Pilot resource library. These outlines are not accredited courses or verified qualifications.</p></header><section className="shell pt-10"><Suspense fallback={<p role="status">Loading resources…</p>}><LearnView/></Suspense></section></main><Footer/></>;}
