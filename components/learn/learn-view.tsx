"use client";
import { Dialog } from "@/components/ui/dialog";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PracticeBlueprint {
  id: string;
  title: string;
  category: "Skilled Trades" | "Technology" | "Creative & Media" | "Engineering & Energy";
  careerSlug: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
  toolsRequired: string[];
  deliverablesEvidence: string[];
  clientScenario: string;
}

const BLUEPRINTS: PracticeBlueprint[] = [
  {
    id: "bp_01",
    title: "3.5kVA Hybrid Solar Inverter Sizing & Installation Plan",
    category: "Engineering & Energy",
    careerSlug: "solar-inverter-technician",
    description:
      "Simulate a real residential client brief: audit total home electrical wattage, size the inverter, calculate battery amp-hours, and draw the DC breaker isolation circuit.",
    difficulty: "Intermediate",
    estimatedTime: "5–7 days",
    toolsRequired: ["Digital Clamp Multimeter", "MC4 Crimping Tool", "Wire Strippers", "CAD / Schematic Software"],
    deliverablesEvidence: [
      "Load calculation spreadsheet (surge vs continuous load)",
      "Single-line electrical diagram showing battery & charge controller wiring",
      "Photographic ground earth testing verification",
    ],
    clientScenario: "A 3-bedroom household in Ikeja spending ₦85,000/month on fuel wants uninterrupted power for a fridge, TV, lighting, and 2 laptops.",
  },
  {
    id: "bp_02",
    title: "16-Drop Cat6 Structured Cabling & Patch Panel Rack",
    category: "Technology",
    careerSlug: "network-technician",
    description:
      "Execute structured Ethernet cabling for a local business office: run cables through trunking, terminate into a 24-port patch panel, test with a cable certifier, and configure subnet.",
    difficulty: "Beginner",
    estimatedTime: "3–4 days",
    toolsRequired: ["Punch-down Tool", "RJ45 Crimping Pliers", "Network Cable Tester", "Label Maker"],
    deliverablesEvidence: [
      "Wiremap test pass reports for all 16 drops",
      "Organized server rack photo showing cable comb management",
      "IP address subnet documentation (VLAN 10 Admin, VLAN 20 Staff)",
    ],
    clientScenario: "A logistics hub in Port Harcourt needs reliable local connection between warehouse PCs and dispatch desks without Wi-Fi dropouts.",
  },
  {
    id: "bp_03",
    title: "Low-Bandwidth Mobile Fintech KYC & Transfer Flow",
    category: "Technology",
    careerSlug: "ui-ux-designer",
    description:
      "Design an ultra-fast, accessible mobile app onboarding and transaction verification flow optimized for 3G/4G network speeds and low-spec Android devices in Nigeria.",
    difficulty: "Intermediate",
    estimatedTime: "2 weeks",
    toolsRequired: ["Figma", "User Journey Flow Builder", "Low-spec Android test device"],
    deliverablesEvidence: [
      "Interactive Figma prototype with complete error state handling",
      "Component design system showing accessibility contrast ratios",
      "Documented user testing notes with 3 real users",
    ],
    clientScenario: "A micro-savings startup needs an account opening flow where users with slow network can upload ID without app crashes or timed-out requests.",
  },
  {
    id: "bp_04",
    title: "Tailored 3-Piece Senator Suit with Geometric Precision",
    category: "Skilled Trades",
    careerSlug: "bespoke-fashion-designer",
    description:
      "Draft a custom pattern, inspect and pre-shrink premium cashmere wool, execute neck piping and shoulder pads, and complete hand-finished hemline stitching.",
    difficulty: "Advanced",
    estimatedTime: "1–2 weeks",
    toolsRequired: ["Industrial Sewing Machine", "Cutting Shears", "Tailor's Chalk", "Pressing Iron"],
    deliverablesEvidence: [
      "Detailed body measurement sheet with posture adjustments",
      "Step-by-step progress photos (cutting, fusing, collar fitting)",
      "Final fitting photos on model showing drape and clean armholes",
    ],
    clientScenario: "A corporate executive needs a sharp, tailored Senator outfit for a wedding ceremony in Abuja with zero armhole creasing.",
  },
  {
    id: "bp_05",
    title: "OBD-II CAN Bus Diagnostics & Sensor Calibration",
    category: "Skilled Trades",
    careerSlug: "automotive-diagnostics-technician",
    description:
      "Connect a scan tool to diagnose intermittent misfire and Check Engine codes on an OBD-II compliant vehicle, inspect live sensor data, and calibrate throttle position.",
    difficulty: "Intermediate",
    estimatedTime: "2–3 days",
    toolsRequired: ["OBD-II Diagnostic Scanner", "Digital Multimeter", "Basic Hand Tool Set"],
    deliverablesEvidence: [
      "Before & after freeze-frame DTC diagnostic report",
      "Live sensor graph reading (MAF sensor & O2 voltage)",
      "Clear customer-facing diagnostic summary sheet",
    ],
    clientScenario: "Vehicle owner experiences high fuel consumption and sluggish acceleration on Third Mainland Bridge with P0300 and P0171 codes.",
  },
  {
    id: "bp_06",
    title: "NDPA Data Privacy & Baseline Vulnerability Assessment",
    category: "Technology",
    careerSlug: "cybersecurity-analyst",
    description:
      "Perform an internal vulnerability scan and compliance audit against the Nigeria Data Protection Act (NDPA) regulations for an SME client handling personal customer data.",
    difficulty: "Advanced",
    estimatedTime: "2 weeks",
    toolsRequired: ["Nmap", "OpenVAS / Nessus", "NDPA Compliance Checklist Template"],
    deliverablesEvidence: [
      "Vulnerability scan results with severity scoring",
      "Data classification and storage risk analysis",
      "Executive summary report with actionable remediation steps",
    ],
    clientScenario: "A secondary school in Lagos collecting student biometric records needs an independent audit to avoid NDPC regulatory penalties.",
  },
];

export function LearnView() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [activeBlueprint, setActiveBlueprint] = useState<PracticeBlueprint | null>(null);

  const filtered = BLUEPRINTS.filter((bp) => {
    if (selectedCategory === "All") return true;
    return bp.category === selectedCategory;
  });

  return (
    <div className="space-y-10" id="practice">
      {/* ── Category Filter Bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white border border-surface-200 rounded-xl p-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
          {["All", "Technology", "Skilled Trades", "Engineering & Energy"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-navy-900 text-white"
                  : "bg-surface-100 hover:bg-surface-200 text-surface-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="text-xs text-surface-500 font-medium">
          {filtered.length} Practice Blueprints
        </span>
      </div>

      {/* ── Practice Blueprints Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((bp) => (
          <article
            key={bp.id}
            className="bg-white border border-surface-200 rounded-xl p-6 hover:shadow-card-md hover:border-teal-500/40 transition-all flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold  px-2 py-0.5 rounded bg-surface-100 text-navy-900">
                  {bp.category}
                </span>
                <span
                  className={`text-2xs font-semibold px-2 py-0.5 rounded ${
                    bp.difficulty === "Beginner"
                      ? "bg-emerald-50 text-emerald-700"
                      : bp.difficulty === "Intermediate"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-purple-50 text-purple-700"
                  }`}
                >
                  {bp.difficulty} · {bp.estimatedTime}
                </span>
              </div>

              <div>
                <h3 className="font-sans text-xl text-navy-900 font-normal leading-snug">
                  {bp.title}
                </h3>
                <p className="text-xs text-surface-500 mt-1.5 leading-relaxed line-clamp-2">
                  {bp.description}
                </p>
              </div>

              {/* Realistic Client Scenario */}
              <div className="p-3 bg-surface-50 rounded-lg border border-surface-200 space-y-1">
                <p className="text-2xs font-bold  text-surface-400">
                  Real Client Scenario
                </p>
                <p className="text-xs text-surface-600 italic line-clamp-2">
                  &ldquo;{bp.clientScenario}&rdquo;
                </p>
              </div>

              {/* Evidence Produced */}
              <div>
                <p className="text-2xs font-bold  text-surface-400 mb-1">
                  Deliverable Proof You Build:
                </p>
                <ul className="space-y-1 text-xs text-surface-600">
                  {bp.deliverablesEvidence.slice(0, 2).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-teal-600 font-bold flex-shrink-0">✓</span>
                      <span className="line-clamp-1">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-surface-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveBlueprint(bp)}
                className="text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                View Full Brief &amp; Checklist →
              </button>
              <Link
                href={`/explore?q=${encodeURIComponent(bp.title)}`}
                className="text-2xs font-bold  text-surface-500 hover:text-navy-900"
              >
                Career Info
              </Link>
            </div>
          </article>
        ))}
      </div>

      {/* ── BLUEPRINT DETAIL MODAL ── */}
      {activeBlueprint && (
        <Dialog label="Practice project details" onClose={() => setActiveBlueprint(null)}>
          <div className="bg-white rounded-2xl border border-surface-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 animate-fade-in relative">
            <button
              type="button"
              onClick={() => setActiveBlueprint(null)}
              className="absolute top-5 right-5 p-2 rounded-lg text-surface-400 hover:text-navy-900 hover:bg-surface-100 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="space-y-2 pr-6">
              <span className="text-2xs font-bold  px-2 py-0.5 rounded bg-surface-100 text-navy-900">
                {activeBlueprint.category} · {activeBlueprint.difficulty}
              </span>
              <h2 className="text-2xl sm:text-3xl font-sans text-navy-900 font-normal">
                {activeBlueprint.title}
              </h2>
              <p className="text-sm text-surface-600 leading-relaxed">
                {activeBlueprint.description}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-50 border border-surface-200 space-y-2">
              <p className="text-2xs font-bold  text-surface-400">
                Client Simulation Brief
              </p>
              <p className="text-sm text-navy-900 italic">
                &ldquo;{activeBlueprint.clientScenario}&rdquo;
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold  text-navy-900">
                Required Physical Tools &amp; Software
              </h3>
              <div className="flex flex-wrap gap-2">
                {activeBlueprint.toolsRequired.map((t, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-medium px-2.5 py-1 rounded bg-surface-100 text-surface-700 border border-surface-200"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-bold  text-navy-900">
                Verifiable Deliverables (Attach to TrustLink)
              </h3>
              <ul className="space-y-1.5 text-sm text-surface-700 list-disc pl-5">
                {activeBlueprint.deliverablesEvidence.map((d, idx) => (
                  <li key={idx}>{d}</li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 space-y-1 text-xs text-teal-950">
              <p className="font-bold">Turn this project into your Trust Profile proof:</p>
              <p className="text-teal-800">
                When completed, upload the documentation files to your TrustLink account. Prospective clients can inspect your actual execution before hiring you.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveBlueprint(null)}
              >
                Close
              </Button>
              <Button
                href="/signup"
                variant="primary"
                size="sm"
              >
                Start Profile to Attach Proof →
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

