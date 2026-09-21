import { Suspense } from "react";
import { Navbar } from "@/components/navigation/navbar";
import { Footer } from "@/components/navigation/footer";
import { PathfinderQuiz } from "@/components/pathfinder/pathfinder-quiz";
export const metadata={title:"Find a practical starting point",description:"Explore paths based on your interests, experience and preferred work style."};
export default function Page(){return <><Navbar/><main id="main-content" className="pb-16"><header className="shell pt-12 pb-10 border-b"><p className="eyebrow">Explore · Pilot</p><h1 className="text-3xl sm:text-4xl mt-4 mb-5">Find a practical starting point</h1><p className="text-surface-600 max-w-2xl">Explore paths based on your interests, experience and preferred work style.</p><p className="text-xs leading-6 text-surface-500 mt-5 max-w-2xl">Pilot questionnaire. Suggestions are based on a small editorial taxonomy, not validated career or labour-market predictions.</p></header><section className="shell pt-10"><Suspense fallback={<p role="status">Loading resources…</p>}><PathfinderQuiz/></Suspense></section></main><Footer/></>;}
