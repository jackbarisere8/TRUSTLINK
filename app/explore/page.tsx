import { Suspense } from "react";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { CareerAtlasView } from "@/components/explore/career-atlas-view";
export const metadata={title:"Career exploration",description:"A small, editorial guide to career and trade pathways."};
export default function Page(){return <><Navbar/><main id="main-content" className="pb-16"><header className="shell pt-12 pb-10 border-b"><p className="eyebrow">Explore · Pilot</p><h1 className="text-3xl sm:text-4xl mt-4 mb-5">Career exploration</h1><p className="text-surface-600 max-w-2xl">A small, editorial guide to career and trade pathways.</p><p className="text-xs leading-6 text-surface-500 mt-5 max-w-2xl">Career and income information is illustrative or editorial, not independently verified. This is a separate pilot, not provider discovery.</p></header><section className="shell pt-10"><Suspense fallback={<p role="status">Loading resources…</p>}><CareerAtlasView/></Suspense></section></main><Footer/></>;}
