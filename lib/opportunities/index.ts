export type OpportunityType =
  | "JOB"
  | "GIG"
  | "INTERNSHIP"
  | "APPRENTICESHIP"
  | "SIWES"
  | "SCHOLARSHIP"
  | "FELLOWSHIP"
  | "TRAINING";

export type OpportunityStatus =
  | "ACTIVE"
  | "DEADLINE_PASSED"
  | "EXPIRED"
  | "REMOVED"
  | "UNVERIFIED";

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
  { type: "JOB",             label: "Full-Time Job",        badgeClass: "bg-blue-50 text-blue-800 border-blue-200" },
  { type: "GIG",             label: "Contract Gig",         badgeClass: "bg-teal-50 text-teal-800 border-teal-200" },
  { type: "INTERNSHIP",      label: "Internship",           badgeClass: "bg-purple-50 text-purple-800 border-purple-200" },
  { type: "APPRENTICESHIP",  label: "Apprenticeship",       badgeClass: "bg-amber-50 text-amber-800 border-amber-200" },
  { type: "SIWES",           label: "SIWES Placement",      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { type: "TRAINING",        label: "Free / TVET Training", badgeClass: "bg-orange-50 text-orange-800 border-orange-200" },
  { type: "FELLOWSHIP",      label: "Fellowship",           badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  { type: "SCHOLARSHIP",     label: "Scholarship",          badgeClass: "bg-rose-50 text-rose-800 border-rose-200" },
];

export const NIGERIAN_STATES = [
  "All States",
  "Lagos",
  "Abuja (FCT)",
  "Rivers (Port Harcourt)",
  "Oyo (Ibadan)",
  "Akwa Ibom (Uyo)",
  "Enugu",
  "Kaduna",
  "Kano",
  "Edo (Benin City)",
  "Delta (Warri / Asaba)",
  "Ogun (Abeokuta)",
  "Remote Nationwide",
];

export const SAMPLE_OPPORTUNITIES: Opportunity[] = [
  {
    id: "opp_01",
    title: "Junior Network Installation Technician",
    organization: "FibreWave Broadband Services",
    locationState: "Lagos",
    locationCity: "Ikeja / Victoria Island",
    isRemote: false,
    type: "JOB",
    compensation: "₦160,000 – ₦220,000 / month",
    careerSlug: "network-technician",
    requiredSkills: ["TCP/IP", "Cat6 Cabling", "Router Setup", "Troubleshooting"],
    description:
      "Looking for a motivated field network technician to assist with fiber drop terminations and enterprise Wi-Fi installations across client sites in Lagos.",
    provenance: {
      sourceName: "Employer Direct Posting",
      sourceUrl: "https://trustlink.ng/opportunities/opp_01",
      dateFound: "2026-09-12",
      isDirectTrustLink: true,
    },
    ageRequirement: "18_PLUS",
    isYouthEligible: false,
    deadline: "30 September 2026",
    expiresAt: "2026-09-30",
    lastCheckedAt: "2026-09-16",
    status: "UNVERIFIED",
    applicationUrl: "/opportunities/opp_01",
  },
  {
    id: "opp_02",
    title: "6-Month Solar Installation Apprenticeship",
    organization: "SunGrid Power Solutions Ltd",
    locationState: "Oyo (Ibadan)",
    locationCity: "Bodija / Dugbe",
    isRemote: false,
    type: "APPRENTICESHIP",
    compensation: "₦65,000 / month transport stipend + safety kit",
    careerSlug: "solar-inverter-technician",
    requiredSkills: ["Basic Electrical Knowledge", "Comfort with Heights", "Hand Tool Dexterity"],
    description:
      "Illustrative apprenticeship description: supervised practice with solar installation tasks. No placement, toolkit or TrustLink contract is offered by this example.",
    provenance: {
      sourceName: "Federal Ministry of Education TVET Initiative / SunGrid",
      sourceUrl: "https://www.tvet.education.gov.ng",
      dateFound: "2026-09-08",
      isDirectTrustLink: false,
    },
    ageRequirement: "ALL_AGES",
    isYouthEligible: true,
    deadline: "15 October 2026",
    expiresAt: "2026-10-15",
    lastCheckedAt: "2026-09-16",
    status: "UNVERIFIED",
    applicationUrl: "/opportunities/opp_02",
  },
  {
    id: "opp_03",
    title: "SIWES Industrial Training — Product UI/UX Design",
    organization: "KoraPay Technologies",
    locationState: "Lagos",
    locationCity: "Lekki Phase 1",
    isRemote: true,
    type: "SIWES",
    compensation: "₦75,000 / month internship stipend",
    careerSlug: "ui-ux-designer",
    requiredSkills: ["Figma Basics", "User Research", "Wireframing"],
    description:
      "Illustrative industrial attachment for university and polytechnic students, showing a possible design-team placement. This is not an approved or available SIWES opening.",
    provenance: {
      sourceName: "ITF SIWES Portal / KoraPay Careers",
      sourceUrl: "https://siwes.itf.gov.ng",
      dateFound: "2026-09-10",
      isDirectTrustLink: false,
    },
    ageRequirement: "ALL_AGES",
    isYouthEligible: true,
    deadline: "20 October 2026",
    expiresAt: "2026-10-20",
    lastCheckedAt: "2026-09-16",
    status: "ACTIVE",
    applicationUrl: "/opportunities/opp_03",
  },
  {
    id: "opp_04",
    title: "Junior Frontend Web Developer (Next.js / Tailwind)",
    organization: "AfriDigital Studios",
    locationState: "Remote Nationwide",
    locationCity: "Remote",
    isRemote: true,
    type: "JOB",
    compensation: "₦250,000 – ₦350,000 / month",
    careerSlug: "software-engineer",
    requiredSkills: ["TypeScript", "Next.js", "Tailwind CSS", "Git"],
    description:
      "Build high-performance web applications for African consumer brands. Strong emphasis on mobile web performance, clean component architecture, and responsive precision.",
    provenance: {
      sourceName: "AfriDigital Job Board",
      sourceUrl: "https://afridigital.com/careers",
      dateFound: "2026-09-14",
      isDirectTrustLink: false,
    },
    ageRequirement: "ALL_AGES",
    isYouthEligible: true,
    deadline: "25 October 2026",
    expiresAt: "2026-10-25",
    lastCheckedAt: "2026-09-16",
    status: "UNVERIFIED",
    applicationUrl: "/opportunities/opp_04",
  },
  {
    id: "opp_05",
    title: "Bespoke Apparel Pattern Maker & Stitcher",
    organization: "Deola Sagoe Atelier / House of Tara Collaborations",
    locationState: "Abuja (FCT)",
    locationCity: "Maitama / Wuse 2",
    isRemote: false,
    type: "GIG",
    compensation: "₦180,000 – ₦300,000 / project",
    careerSlug: "bespoke-fashion-designer",
    requiredSkills: ["Industrial Sewing", "Pattern Drafting", "Garment Finishing"],
    description:
      "Contract engagement for 4 weeks constructing a capsule luxury bridal collection. Work with high-end silk, damask, and structured brocade under master cutters.",
    provenance: {
      sourceName: "NiYA Gigs & Creative Directory",
      sourceUrl: "https://niya.gov.ng",
      dateFound: "2026-09-05",
      isDirectTrustLink: false,
    },
    ageRequirement: "18_PLUS",
    isYouthEligible: false,
    deadline: "12 October 2026",
    expiresAt: "2026-10-12",
    lastCheckedAt: "2026-09-16",
    status: "ACTIVE",
    applicationUrl: "/opportunities/opp_05",
  },
  {
    id: "opp_06",
    title: "Automotive Scan Diagnostics & ECU Flashing Intern",
    organization: "Precision AutoCare Services",
    locationState: "Akwa Ibom (Uyo)",
    locationCity: "Uyo Central",
    isRemote: false,
    type: "INTERNSHIP",
    compensation: "₦50,000 / month stipend + certification",
    careerSlug: "automotive-diagnostics-technician",
    requiredSkills: ["OBD-II Scanning", "Basic Electronics", "Automotive Wiring"],
    description:
      "Illustrative technician training description: diagnostic scanners and vehicle networks under supervision. No trainer or qualification has been independently assessed.",
    provenance: {
      sourceName: "LEEP Jobs National Placement Feed",
      sourceUrl: "https://jobs.leep.gov.ng",
      dateFound: "2026-09-11",
      isDirectTrustLink: false,
    },
    ageRequirement: "ALL_AGES",
    isYouthEligible: true,
    deadline: "31 October 2026",
    expiresAt: "2026-10-31",
    lastCheckedAt: "2026-09-16",
    status: "UNVERIFIED",
    applicationUrl: "/opportunities/opp_06",
  },
  {
    id: "opp_07",
    title: "SOC Junior Analyst — Cyber Threat Detection",
    organization: "SecureShield Nigeria MSSP",
    locationState: "Rivers (Port Harcourt)",
    locationCity: "Port Harcourt / Remote hybrid",
    isRemote: false,
    type: "JOB",
    compensation: "₦350,000 – ₦500,000 / month",
    careerSlug: "cybersecurity-analyst",
    requiredSkills: ["SIEM Log Analysis", "Wireshark", "Network Defense", "NDPA Awareness"],
    description:
      "Monitor security operations center alerts, investigate anomalous network ingress, triage firewall logs, and write incident triage summaries.",
    provenance: {
      sourceName: "Employer Direct Posting",
      sourceUrl: "https://trustlink.ng/opportunities/opp_07",
      dateFound: "2026-09-13",
      isDirectTrustLink: true,
    },
    ageRequirement: "18_PLUS",
    isYouthEligible: false,
    deadline: "18 October 2026",
    expiresAt: "2026-10-18",
    lastCheckedAt: "2026-09-16",
    status: "UNVERIFIED",
    applicationUrl: "/opportunities/opp_07",
  },
  {
    id: "opp_08",
    title: "National TVET Vocational Electrical Certification",
    organization: "Federal Ministry of Education / NABTEB",
    locationState: "Kaduna",
    locationCity: "Kaduna Polytechnic Training Centre",
    isRemote: false,
    type: "TRAINING",
    compensation: "Full Tuition Funded + Workshop Allowance",
    careerSlug: "electrical-installation-artisan",
    requiredSkills: ["Numeracy Basics", "Interest in Building Construction"],
    description:
      "Fully sponsored practical technical training in single-phase and three-phase building wiring, conduit bending, DB assembly, and earthing installation standards.",
    provenance: {
      sourceName: "FME TVET National Initiative",
      sourceUrl: "https://www.tvet.education.gov.ng",
      dateFound: "2026-09-01",
      isDirectTrustLink: false,
    },
    ageRequirement: "YOUTH_FOCUSED",
    isYouthEligible: true,
    deadline: "05 November 2026",
    expiresAt: "2026-11-05",
    lastCheckedAt: "2026-09-16",
    status: "ACTIVE",
    applicationUrl: "/opportunities/opp_08",
  },
];
