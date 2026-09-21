"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const POPULAR_SEARCHES = [
  { label: "Solar Inverter Tech", query: "solar" },
  { label: "Network Cabling", query: "network" },
  { label: "UI/UX Design", query: "ui/ux" },
  { label: "Bespoke Fashion", query: "tailoring" },
  { label: "Auto Diagnostics", query: "auto" },
  { label: "Cybersecurity", query: "security" },
];

export function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      router.push("/explore");
      return;
    }
    router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
  };

  const handleQuickChip = (term: string) => {
    router.push(`/explore?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSearch} className="relative flex items-center">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-surface-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search careers, skilled trades, skills, or opportunities (e.g. Solar, Cat6, UI/UX)..."
            className="w-full pl-11 pr-28 py-3.5 bg-navy-800/90 text-white placeholder-surface-400 text-sm rounded-xl border border-navy-700 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all shadow-inner"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-navy-950 font-semibold text-xs rounded-lg transition-colors shadow-sm"
          >
            Explore →
          </button>
        </div>
      </form>

      {/* Quick Search Chips */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <span className="text-2xs font-bold  text-surface-400">Popular:</span>
        {POPULAR_SEARCHES.map(({ label, query: chipQuery }) => (
          <button
            key={label}
            type="button"
            onClick={() => handleQuickChip(chipQuery)}
            className="text-xs px-2.5 py-1 rounded-full bg-navy-800/80 hover:bg-navy-700 text-surface-300 hover:text-teal-300 border border-navy-700/80 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

