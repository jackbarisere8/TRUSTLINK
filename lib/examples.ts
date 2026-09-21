import type { PublicJobProjection } from "./db/types";
export const exampleRecord: PublicJobProjection = {
  publicId: "sample-website-project", status: "SENT", sourceChannel: "WhatsApp",
  providerLocation: "Lagos, Nigeria", createdAt: "2026-09-18T09:00:00.000Z",
  service: "Brand website refresh", serviceCategory: "Web design",
  scope: "A five-page responsive website for a growing business, with a simple content management system and a handoff session.",
  deliverables: ["Home, About, Services, Work and Contact pages", "Layouts for phone, tablet and desktop", "CMS setup and a recorded handoff session"],
  price: "180000", currency: "NGN", deadline: "2026-10-18", revisionsIncluded: 2, revisionsUsed: 0,
  cancellationTerms: "Discuss changes before work begins. Any payment or refund is arranged directly between the parties.",
  provider: { username: "amaka", displayName: "Amaka Okafor", initials: "AO", headline: "Web designer & frontend developer", verificationStatus: "UNVERIFIED" },
};
