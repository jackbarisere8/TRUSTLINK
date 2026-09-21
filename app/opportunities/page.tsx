import { Suspense } from "react";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { OpportunityListView } from "@/components/opportunities/opportunity-list-view";
export const metadata={title:"Opportunity examples",description:"Explore how jobs, placements and training could be described."};
export default function Page(){return <><Navbar/><main id="main-content" className="pb-16"><header className="shell pt-12 pb-10 border-b"><p className="eyebrow">Explore · Pilot</p><h1 className="text-3xl sm:text-4xl mt-4 mb-5">Opportunity examples</h1><p className="text-surface-600 max-w-2xl">Explore how jobs, placements and training could be described.</p><p className="text-xs leading-6 text-surface-500 mt-5 max-w-2xl">Pilot concept. There are no confirmed live vacancies or application services here.</p></header><section className="shell pt-10"><Suspense fallback={<p role="status">Loading resources…</p>}><OpportunityListView/></Suspense></section></main><Footer/></>;}
