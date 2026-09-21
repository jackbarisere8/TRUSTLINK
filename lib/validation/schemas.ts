import { z } from "zod";
export const sourceChannels = ["WhatsApp", "Instagram", "Referral", "Direct", "X (Twitter)", "LinkedIn", "Facebook", "TikTok", "Telegram", "SMS", "Email", "QR Code", "Other"] as const;
const text = (max: number) => z.string().trim().min(1).max(max);
export const createJobSchema = z.object({
  confirmed: z.literal(true),
  title: text(160), category: text(100), scope: text(10000),
  deliverables: z.array(text(500)).min(1).max(30),
  price: z.string().trim().regex(/^\d{1,9}(\.\d{1,2})?$/, "Enter an amount without commas or a currency symbol.").refine(v => Number(v) > 0),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v && v >= new Date().toISOString().slice(0,10), "Choose a valid date today or later."),
  revisions: z.number().int().min(0).max(20), cancellationTerms: text(3000),
  sourceChannel: z.enum(sourceChannels), repeatUse: z.enum(["FIRST", "PROMPTED", "UNPROMPTED"]),
});
export const acceptanceSchema = z.object({ name: text(120), email: z.email().max(254), phone: z.string().trim().max(30).optional(), confirmed: z.literal(true) });
export const profileSchema = z.object({ displayName: text(120), country: text(80), state: z.string().trim().max(100), city: z.string().trim().max(100), headline: text(160), bio: z.string().trim().max(2000), serviceArea: text(160) });
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("PAYMENT"), reference: z.string().trim().max(200).optional(), notes: z.string().trim().max(2000).optional() }),
  z.object({ type: z.literal("START") }),
  z.object({ type: z.literal("DELIVER"), description: text(5000), files: z.array(text(500)).max(10) }),
  z.object({ type: z.literal("REVISE"), description: text(5000) }),
  z.object({ type: z.literal("APPROVE") }),
  z.object({ type: z.literal("COMPLETE") }),
  z.object({ type: z.literal("CANCEL") }),
  z.object({ type: z.literal("DISPUTE"), contestedTerm: z.enum(["Scope", "Quality", "Deadline", "Payment", "Communication"]), description: text(5000), files: z.array(text(500)).max(10) }),
  z.object({ type: z.literal("RESOLVE"), notes: text(5000), outcome: z.enum(["IN_PROGRESS", "CANCELLED"]) }),
  z.object({ type: z.literal("REVIEW"), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(3000).optional() }),
  z.object({ type: z.literal("ROTATE_INVITE") }),
]);
export type JobCommand = z.infer<typeof commandSchema>;
