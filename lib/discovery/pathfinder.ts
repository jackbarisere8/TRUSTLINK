import { CAREER_TAXONOMY, type Career } from "./careers";

export interface PathfinderAnswers {
  interest: string;
  workStyle: string;
  situation: string;
  goal: string;
}

export type MatchTier = "Strong match" | "Possible fit" | "Worth exploring";

export interface PathfinderRecommendation {
  career: Career;
  matchScore: number;
  matchTier: MatchTier;
  matchReasons: string[];
  recommendedFirstStep: string;
}

export const PATHFINDER_QUESTIONS = [
  {
    id: "interest",
    title: "What naturally catches your attention?",
    subtitle: "Select the area you feel most curious about exploring.",
    options: [
      {
        value: "tech",
        label: "Computers, software, and the internet",
        hint: "Code, digital tools, websites, applications",
      },
      {
        value: "hands",
        label: "Building, wiring, repairing, and physical machines",
        hint: "Electricals, vehicle engines, tools, workshop craftsmanship",
      },
      {
        value: "creative",
        label: "Design, fashion, visual styling, and creativity",
        hint: "Apparel, user interfaces, branding, visual storytelling",
      },
      {
        value: "energy",
        label: "Solar energy, power systems, and electrical installations",
        hint: "Inverters, battery storage, clean energy solutions",
      },
      {
        value: "security",
        label: "Protecting systems, investigating threats, and network defense",
        hint: "Cyber defense, network setup, digital security",
      },
    ],
  },
  {
    id: "workStyle",
    title: "How do you prefer to spend your workday?",
    subtitle: "Think about the physical reality of how you enjoy working.",
    options: [
      {
        value: "computer",
        label: "Primarily on a laptop or computer screen",
        hint: "Remote-friendly, deep focus on digital interfaces and code",
      },
      {
        value: "active_hands",
        label: "Active with hands, tools, and materials",
        hint: "Physical motion, using hand tools, assembling real objects",
      },
      {
        value: "hybrid_field",
        label: "A mix of field site visits, customer premises, and technical setup",
        hint: "Meeting clients on-site, testing cables, installing hardware",
      },
    ],
  },
  {
    id: "situation",
    title: "What describes your current situation?",
    subtitle: "We tailor pathways to your real starting point.",
    options: [
      {
        value: "student_minor",
        label: "Secondary school student (under 18)",
        hint: "Focusing on safe exploration, education, and foundational skills",
      },
      {
        value: "school_leaver",
        label: "Secondary school leaver / seeking practical vocation",
        hint: "Ready for hands-on apprenticeship or direct skill acquisition",
      },
      {
        value: "undergrad",
        label: "University or Polytechnic undergraduate",
        hint: "Seeking SIWES placement, internships, and portfolio projects",
      },
      {
        value: "graduate_career_change",
        label: "Graduate or working professional seeking transition",
        hint: "Looking for high-demand pathways with fast economic return",
      },
    ],
  },
  {
    id: "goal",
    title: "What is your primary goal right now?",
    subtitle: "This helps prioritize the most suitable entry route.",
    options: [
      {
        value: "employable_fast",
        label: "Become employable and start earning in under 12 months",
        hint: "Practical apprenticeship or focused technical bootcamp",
      },
      {
        value: "freelance_clients",
        label: "Work independently with direct clients via TrustLink",
        hint: "Bespoke trades, design, web creation, independent contracts",
      },
      {
        value: "corporate_career",
        label: "Build a specialized career in companies and institutions",
        hint: "Cybersecurity, engineering, corporate systems administration",
      },
    ],
  },
];

export function calculatePathfinderRecommendations(
  answers: PathfinderAnswers
): PathfinderRecommendation[] {
  const recommendations: PathfinderRecommendation[] = [];

  for (const career of CAREER_TAXONOMY) {
    let score = 50;
    const reasons: string[] = [];

    // Filter minor safety
    if (answers.situation === "student_minor" && !career.suitableForMinors) {
      continue; // Skip hazardous trades for minors
    }

    // Match Interest
    if (answers.interest === "tech") {
      if (career.category === "Technology") {
        score += 35;
        reasons.push("Directly matches your interest in digital computing and software systems.");
      }
    } else if (answers.interest === "hands") {
      if (career.category === "Skilled Trades" || career.slug === "automotive-diagnostics-technician") {
        score += 40;
        reasons.push("Aligns with your enjoyment of physical tools, machinery, and tactile diagnosis.");
      }
    } else if (answers.interest === "creative") {
      if (career.category === "Creative & Media") {
        score += 40;
        reasons.push("Provides a direct outlet for your visual styling, design, and aesthetic skills.");
      }
    } else if (answers.interest === "energy") {
      if (career.category === "Engineering & Energy" || career.slug === "electrical-installation-artisan") {
        score += 45;
        reasons.push("Capitalizes on Nigeria's rapid transition to decentralized solar power and electrical upgrades.");
      }
    } else if (answers.interest === "security") {
      if (career.slug === "cybersecurity-analyst" || career.slug === "network-technician") {
        score += 45;
        reasons.push("Focuses on investigating digital infrastructure, network packets, and system defense.");
      }
    }

    // Match Work Style
    if (answers.workStyle === "computer") {
      if (career.slug === "software-engineer" || career.slug === "ui-ux-designer" || career.slug === "cybersecurity-analyst") {
        score += 25;
        reasons.push("Permits remote or screen-based technical practice without requiring outdoor physical labor.");
      }
    } else if (answers.workStyle === "active_hands") {
      if (career.category === "Skilled Trades" || career.category === "Engineering & Energy") {
        score += 25;
        reasons.push("Puts you in workshop and job-site environments with physical tools every day.");
      }
    } else if (answers.workStyle === "hybrid_field") {
      if (career.slug === "network-technician" || career.slug === "solar-energy-technician") {
        score += 25;
        reasons.push("Blends technical configuration with active on-site client installations.");
      }
    }

    // Match Goal
    if (answers.goal === "freelance_clients") {
      if (career.slug === "ui-ux-designer" || career.slug === "fashion-designer-apparel-maker" || career.slug === "solar-energy-technician") {
        score += 20;
        reasons.push("Offers high independent client demand where you can structure jobs directly with TrustLink.");
      }
    } else if (answers.goal === "employable_fast") {
      if (career.entryRoutes.some((r) => r.typicalDuration.includes("6") || r.typicalDuration.includes("3"))) {
        score += 20;
        reasons.push("Has practical entry routes that can be achieved in under 12 months.");
      }
    }

    let firstStep = "Explore foundational concepts and review real project specifications on TrustLink.";
    if (career.entryRoutes.length > 0) {
      firstStep = `Start with the ${career.entryRoutes[0].title} pathway (${career.entryRoutes[0].typicalDuration}).`;
    }

    let matchTier: MatchTier = "Worth exploring";
    if (score >= 75) {
      matchTier = "Strong match";
    } else if (score >= 60) {
      matchTier = "Possible fit";
    }

    recommendations.push({
      career,
      matchScore: score,
      matchTier,
      matchReasons: reasons.length > 0 ? reasons : ["Provides a viable pathway based on your preferences."],
      recommendedFirstStep: firstStep,
    });
  }

  // Sort descending by match score
  return recommendations.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
}

export const evaluatePathfinder = calculatePathfinderRecommendations;
