export type OpportunityType =
  | "JOB"
  | "GIG"
  | "INTERNSHIP"
  | "APPRENTICESHIP"
  | "SIWES"
  | "SCHOLARSHIP"
  | "FELLOWSHIP"
  | "TRAINING";

export type OpportunityStatus = "ACTIVE" | "DEADLINE_PASSED" | "EXPIRED" | "REMOVED" | "UNVERIFIED";

export interface OpportunityProvenance {
  sourceName: string;
  sourceUrl: string;
  dateFound: string;
  isDirectTrustLink: boolean;
}

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  locationState: string;
  locationCity: string;
  isRemote: boolean;
  type: OpportunityType;
  compensation: string;
  careerSlug: string;
  requiredSkills: string[];
  description: string;
  provenance: OpportunityProvenance;
  ageRequirement: "ALL_AGES" | "18_PLUS" | "YOUTH_FOCUSED";
  isYouthEligible: boolean;
  deadline: string;
  expiresAt: string;
  lastCheckedAt: string;
  status: OpportunityStatus;
  applicationUrl: string;
}

export const OPPORTUNITY_TYPES: { type: OpportunityType; label: string; badgeClass: string }[] = [
  { type: "JOB", label: "Full-Time Job", badgeClass: "bg-blue-50 text-blue-800 border-blue-200" },
  { type: "GIG", label: "Contract Gig", badgeClass: "bg-teal-50 text-teal-800 border-teal-200" },
  { type: "INTERNSHIP", label: "Internship", badgeClass: "bg-purple-50 text-purple-800 border-purple-200" },
  { type: "APPRENTICESHIP", label: "Apprenticeship", badgeClass: "bg-amber-50 text-amber-800 border-amber-200" },
  { type: "SIWES", label: "SIWES Placement", badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { type: "TRAINING", label: "Training", badgeClass: "bg-orange-50 text-orange-800 border-orange-200" },
  { type: "FELLOWSHIP", label: "Fellowship", badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  { type: "SCHOLARSHIP", label: "Scholarship", badgeClass: "bg-rose-50 text-rose-800 border-rose-200" },
];

export const NIGERIAN_STATES = [
  "All States",
  "Lagos",
  "Abuja (FCT)",
  "Rivers",
  "Oyo",
  "Akwa Ibom",
  "Enugu",
  "Kaduna",
  "Kano",
  "Edo",
  "Delta",
  "Ogun",
  "Remote Nationwide",
];

type SyntheticOpportunityInput = Pick<
  Opportunity,
  "id" | "title" | "locationState" | "locationCity" | "isRemote" | "type" | "careerSlug" | "requiredSkills" | "description" | "ageRequirement" | "isYouthEligible"
>;

function syntheticOpportunity(input: SyntheticOpportunityInput): Opportunity {
  return {
    ...input,
    organization: "Synthetic example organization",
    compensation: "Illustrative only - no verified rate",
    provenance: {
      sourceName: "TrustLink synthetic example",
      sourceUrl: "/opportunities",
      dateFound: "Not applicable",
      isDirectTrustLink: false,
    },
    deadline: "No live deadline",
    expiresAt: "9999-12-31",
    lastCheckedAt: "Not applicable",
    status: "UNVERIFIED",
    applicationUrl: "/opportunities",
  };
}

/**
 * Editorial UI fixtures only. They are not vacancies, placements, training
 * offers, employer partnerships, applications, compensation evidence, or
 * statements that the named kind of work is currently available.
 */
export const SAMPLE_OPPORTUNITIES: Opportunity[] = [
  syntheticOpportunity({
    id: "opp_01",
    title: "Junior Network Installation Technician",
    locationState: "Lagos",
    locationCity: "Ikeja",
    isRemote: false,
    type: "JOB",
    careerSlug: "network-technician",
    requiredSkills: ["TCP/IP", "Cat6 cabling", "Router setup", "Troubleshooting"],
    description: "Synthetic example showing how an entry-level network installation role could be described.",
    ageRequirement: "18_PLUS",
    isYouthEligible: false,
  }),
  syntheticOpportunity({
    id: "opp_02",
    title: "Solar Installation Apprenticeship",
    locationState: "Oyo",
    locationCity: "Ibadan",
    isRemote: false,
    type: "APPRENTICESHIP",
    careerSlug: "solar-energy-technician",
    requiredSkills: ["Basic electrical knowledge", "Safe tool handling", "Supervised site practice"],
    description: "Synthetic example showing the fields a supervised solar apprenticeship listing would need.",
    ageRequirement: "18_PLUS",
    isYouthEligible: false,
  }),
  syntheticOpportunity({
    id: "opp_03",
    title: "Product UI/UX Industrial Training",
    locationState: "Lagos",
    locationCity: "Lekki",
    isRemote: true,
    type: "SIWES",
    careerSlug: "ui-ux-designer",
    requiredSkills: ["Figma basics", "User research", "Wireframing"],
    description: "Synthetic example of a design placement. It is not an approved or available SIWES opening.",
    ageRequirement: "ALL_AGES",
    isYouthEligible: true,
  }),
  syntheticOpportunity({
    id: "opp_04",
    title: "Junior Frontend Web Developer",
    locationState: "Remote Nationwide",
    locationCity: "Remote",
    isRemote: true,
    type: "JOB",
    careerSlug: "software-engineer",
    requiredSkills: ["TypeScript", "Next.js", "CSS", "Git"],
    description: "Synthetic example showing how a junior frontend role could state its responsibilities and required skills.",
    ageRequirement: "18_PLUS",
    isYouthEligible: false,
  }),
  syntheticOpportunity({
    id: "opp_05",
    title: "Bespoke Apparel Pattern Maker",
    locationState: "Abuja (FCT)",
    locationCity: "Abuja",
    isRemote: false,
    type: "GIG",
    careerSlug: "fashion-designer-apparel-maker",
    requiredSkills: ["Industrial sewing", "Pattern drafting", "Garment finishing"],
    description: "Synthetic example showing how a short apparel project could define its expected craft skills.",
    ageRequirement: "18_PLUS",
    isYouthEligible: false,
  }),
  syntheticOpportunity({
    id: "opp_06",
    title: "Automotive Diagnostics Internship",
    locationState: "Akwa Ibom",
    locationCity: "Uyo",
    isRemote: false,
    type: "INTERNSHIP",
    careerSlug: "automotive-diagnostics-technician",
    requiredSkills: ["OBD-II basics", "Basic electronics", "Automotive wiring"],
    description: "Synthetic example of supervised diagnostics practice. No trainer or qualification has been assessed.",
    ageRequirement: "18_PLUS",
    isYouthEligible: false,
  }),
  syntheticOpportunity({
    id: "opp_07",
    title: "Junior Security Operations Analyst",
    locationState: "Rivers",
    locationCity: "Port Harcourt",
    isRemote: true,
    type: "JOB",
    careerSlug: "cybersecurity-analyst",
    requiredSkills: ["Log analysis", "Network fundamentals", "Incident documentation"],
    description: "Synthetic example showing how an entry-level security operations role could be structured.",
    ageRequirement: "18_PLUS",
    isYouthEligible: false,
  }),
  syntheticOpportunity({
    id: "opp_08",
    title: "Electrical Installation Practice Programme",
    locationState: "Kaduna",
    locationCity: "Kaduna",
    isRemote: false,
    type: "TRAINING",
    careerSlug: "electrical-installation-artisan",
    requiredSkills: ["Numeracy basics", "Electrical safety interest", "Supervised workshop practice"],
    description: "Synthetic example showing the details a vocational training listing should disclose before publication.",
    ageRequirement: "18_PLUS",
    isYouthEligible: false,
  }),
];
