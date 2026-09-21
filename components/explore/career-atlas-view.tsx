"use client";
import { Dialog } from "@/components/ui/dialog";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CAREER_TAXONOMY,
  type Career,
  type CareerCategory,
} from "@/lib/discovery/careers";
import { Button } from "@/components/ui/button";

const ALL_CATEGORIES: ("All" | CareerCategory)[] = [
  "All",
  "Technology",
  "Skilled Trades",
  "Engineering & Energy",
  "Creative & Media",
];

export function CareerAtlasView() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("cat") || "All";
  const initialQuery = searchParams.get("q") || "";

  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [minorOnly, setMinorOnly] = useState<boolean>(false);
  const [activeCareerModal, setActiveCareerModal] = useState<Career | null>(null);

  const filteredCareers = useMemo(() => {
    return CAREER_TAXONOMY.filter((career) => {
      // Category match
      if (selectedCategory !== "All" && career.category !== selectedCategory) {
        return false;
      }
      // Minor safety filter
      if (minorOnly && !career.suitableForMinors) {
        return false;
      }
      // Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = career.title.toLowerCase().includes(q);
        const inTagline = career.tagline.toLowerCase().includes(q);
        const inTools = career.toolsRequired.some((t) => t.toLowerCase().includes(q));
        const inSkills = career.technicalSkills.some((s) => s.toLowerCase().includes(q));
        const inDesc = career.description.toLowerCase().includes(q);
        if (!inTitle && !inTagline && !inTools && !inSkills && !inDesc) {
          return false;
        }
      }
      return true;
    });
  }, [selectedCategory, searchQuery, minorOnly]);

  return (
    <div className="space-y-8">
      {/* ── Prominent Pathfinder Bridge Banner ── */}
      <div className="bg-gradient-to-r from-navy-900 via-navy-800 to-navy-900 border border-teal-500/30 rounded-2xl p-6 sm:p-7 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-2xs font-semibold">
            <span>Directional Guidance</span>
            <span>·</span>
            <span>2 Minutes</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-sans font-normal">
            Unsure which trade or tech pathway suits your strengths?
          </h2>
          <p className="text-xs sm:text-sm text-surface-300 leading-relaxed">
            Take the interactive Pathfinder questionnaire. We evaluate your natural curiosity, physical work style, and current education level against real Nigerian economic demand.
          </p>
        </div>
        <Button
          href="/pathfinder"
          variant="secondary"
          size="md"
          className="flex-shrink-0 whitespace-nowrap"
        >
          Start Pathfinder Quiz (2m) →
        </Button>
      </div>

      {/* ── Filter Controls ── */}
      <div className="bg-white border border-surface-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-surface-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by title, tool (e.g. Inverter, Cat6, Figma)..."
              className="w-full pl-10 pr-4 py-2.5 bg-surface-50 border border-surface-200 rounded-lg text-sm text-navy-900 placeholder-surface-400 focus:outline-none focus:border-teal-600 focus:bg-white transition-all"
            />
          </div>

          {/* Under-18 Safeguard Filter */}
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-surface-600 cursor-pointer select-none bg-surface-50 px-3 py-2 rounded-lg border border-surface-200">
            <input
              type="checkbox"
              checked={minorOnly}
              onChange={(e) => setMinorOnly(e.target.checked)}
              className="rounded border-surface-300 text-teal-600 focus:ring-teal-500 w-4 h-4"
            />
            <span>Suitable for Secondary Students (&lt;18, self-declared criteria)</span>
          </label>
        </div>

        {/* Category Pill Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {ALL_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-navy-900 text-white shadow-sm"
                    : "bg-surface-100 hover:bg-surface-200 text-surface-600"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Results Count ── */}
      <div className="flex items-center justify-between text-xs text-surface-500 px-1">
        <span>
          Showing <strong>{filteredCareers.length}</strong> {filteredCareers.length === 1 ? "career pathway" : "career pathways"}
        </span>
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-teal-600 hover:underline font-medium"
          >
            Clear search
          </button>
        )}
      </div>

      {/* ── Career Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCareers.map((career) => (
          <article
            key={career.id}
            id={career.slug}
            className="bg-white border border-surface-200 rounded-xl p-6 hover:shadow-card-md hover:border-teal-500/40 transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              {/* Category & Status */}
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold  px-2 py-0.5 rounded bg-surface-100 text-navy-800">
                  {career.category}
                </span>
                <span
                  className={`text-2xs font-semibold px-2 py-0.5 rounded border ${
                    career.trendStatus === "Emerging"
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  Editorial: {career.trendStatus}
                </span>
              </div>

              {/* Title & Tagline */}
              <div>
                <h3 className="font-sans text-2xl text-navy-900 font-normal leading-snug">
                  {career.title}
                </h3>
                <p className="text-xs text-surface-500 mt-1.5 leading-relaxed line-clamp-2">
                  {career.tagline}
                </p>
              </div>

              {/* Key Highlights */}
              <div className="space-y-2 py-3 border-y border-surface-100 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-surface-400 font-medium">Typical reported range:</span>
                    <span className="font-semibold text-navy-900 font-mono">
                      {career.typicalIncomeRange}
                    </span>
                  </div>
                  <p className="text-2xs text-surface-400 italic">
                    *Informational estimate; varies by location, experience &amp; employer.
                  </p>
                </div>
                <div className="flex items-start justify-between gap-2 pt-1">
                  <span className="text-surface-400 font-medium flex-shrink-0">Essential tools:</span>
                  <span className="text-right text-surface-600 truncate">
                    {career.toolsRequired.slice(0, 2).join(", ")}
                  </span>
                </div>
              </div>

              {/* Workday Tasks Preview */}
              <div>
                <p className="text-2xs font-bold  text-surface-400 mb-1.5">
                  Typical Day-to-Day Tasks
                </p>
                <ul className="space-y-1 text-xs text-surface-600">
                  {career.workdayTasks.slice(0, 2).map((task, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-teal-600 mt-0.5 flex-shrink-0">•</span>
                      <span className="line-clamp-1">{task}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-5 mt-4 border-t border-surface-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveCareerModal(career)}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 py-1"
              >
                View Full Roadmap →
              </button>
              <Link
                href={`/opportunities?career=${career.slug}`}
                className="text-2xs font-bold  text-navy-900 bg-surface-100 hover:bg-surface-200 px-3 py-1.5 rounded transition-colors"
              >
                Find Gigs &amp; Jobs
              </Link>
            </div>
          </article>
        ))}
      </div>

      {filteredCareers.length === 0 && (
        <div className="text-center py-16 bg-white border border-surface-200 rounded-xl p-8 space-y-4">
          <p className="text-xl font-sans text-navy-900">No pathways match your filter</p>
          <p className="text-sm text-surface-500 max-w-md mx-auto">
            Try resetting your search query or selecting &ldquo;All&rdquo; categories to explore the complete Nigerian career catalog.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedCategory("All");
              setSearchQuery("");
              setMinorOnly(false);
            }}
          >
            Reset Filters
          </Button>
        </div>
      )}

      {/* ── CAREER DETAIL MODAL / DRAWER ── */}
      {activeCareerModal && (
        <Dialog label="Career details" onClose={() => setActiveCareerModal(null)}>
          <div className="bg-white rounded-2xl border border-surface-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 animate-fade-in relative">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveCareerModal(null)}
              className="absolute top-5 right-5 p-2 rounded-lg text-surface-400 hover:text-navy-900 hover:bg-surface-100 transition-colors"
              aria-label="Close details"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="space-y-2 pr-8">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-bold  px-2 py-0.5 rounded bg-surface-100 text-navy-800">
                  {activeCareerModal.category}
                </span>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Editorial: {activeCareerModal.trendStatus}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-sans text-navy-900 font-normal">
                {activeCareerModal.title}
              </h2>
              <p className="text-sm text-surface-600 leading-relaxed">
                {activeCareerModal.description}
              </p>
            </div>

            {/* Nigerian Income & Trend Signal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-50 border border-surface-200">
              <div>
                <p className="text-2xs font-bold  text-surface-400">
                  Typical Reported Range (Informational Estimate)
                </p>
                <p className="text-base font-semibold text-teal-700 font-mono mt-0.5">
                  {activeCareerModal.typicalIncomeRange}
                </p>
                <p className="text-2xs text-surface-500 mt-1 italic">
                  Editorial estimate, not independently verified. Actual pay varies by location, experience and employer.
                </p>
              </div>
              <div>
                <p className="text-2xs font-bold  text-surface-400">
                  Empirical Trend Signal
                </p>
                <p className="text-xs text-navy-900 mt-0.5">
                  {activeCareerModal.trendSignal.summary}
                </p>
                <p className="text-2xs text-surface-500 mt-1">
                  Unverified source reference: {activeCareerModal.trendSignal.source} ({activeCareerModal.trendSignal.date})
                </p>
              </div>
            </div>

            {/* Workday Tasks */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold  text-navy-900">
                What a Real Workday Looks Like
              </h3>
              <ul className="space-y-1.5 text-sm text-surface-600 list-disc pl-5">
                {activeCareerModal.workdayTasks.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ul>
            </div>

            {/* Entry Routes */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold  text-navy-900">
                Real Starting Routes in Nigeria
              </h3>
              <div className="space-y-2.5">
                {activeCareerModal.entryRoutes.map((route, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-surface-200 bg-white space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-navy-900">{route.title}</span>
                      <span className="text-surface-500 font-mono">{route.typicalDuration}</span>
                    </div>
                    <p className="text-xs text-surface-600">{route.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Required Tools */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold  text-navy-900">
                Essential Tools You Need to Master
              </h3>
              <div className="flex flex-wrap gap-2">
                {activeCareerModal.toolsRequired.map((tool, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-medium px-2.5 py-1 rounded bg-surface-100 text-surface-700 border border-surface-200"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-surface-200 flex flex-col sm:flex-row gap-3 justify-end">
              <Button
                href={`/learn?career=${activeCareerModal.slug}`}
                variant="outline"
                size="md"
              >
                View Skill &amp; Practice Blueprint
              </Button>
              <Button
                href={`/opportunities?career=${activeCareerModal.slug}`}
                variant="primary"
                size="md"
              >
                Find Opportunities in this Role →
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
