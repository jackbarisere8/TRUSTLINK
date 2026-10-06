import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || undefined);
const money = z.string().trim().regex(/^\d{1,12}(\.\d{1,2})?$/, "Enter an amount without commas or a currency symbol.").refine(value => Number(value)>0);
const instant = z.string().refine(value => Number.isFinite(Date.parse(value)), "Choose a valid date and time.");

export const bookingMutationRequestSchema = z.object({
  id: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
});

export const createBookingSchema = z.object({
  bookingId: z.uuid(),
  providerId: z.uuid(),
  providerServiceId: z.uuid(),
  requestText: text(3000),
  requestedStart: instant,
  durationMinutes: z.number().int().min(15).max(10080),
  locationMode: z.enum(["REMOTE", "PROVIDER_LOCATION", "CUSTOMER_LOCATION"]),
  stateCode: z.string().regex(/^NG\d{3}$/).optional(),
  lgaCode: z.string().regex(/^NG\d{6}$/).optional(),
  broadArea: optionalText(160),
  privateAddress: optionalText(500),
  budgetMin: money.optional(),
  budgetMax: money.optional(),
}).superRefine((value, context) => {
  if (value.locationMode === "REMOTE" && (value.stateCode || value.lgaCode || value.privateAddress)) {
    context.addIssue({ code: "custom", message: "Remote bookings cannot contain a physical location." });
  }
  if (value.locationMode !== "REMOTE" && !value.stateCode) {
    context.addIssue({ code: "custom", message: "Choose a state for an in-person booking." });
  }
  if (value.lgaCode && value.lgaCode.slice(0,5) !== value.stateCode) {
    context.addIssue({ code: "custom", message: "The selected LGA does not belong to the selected state." });
  }
  if (value.budgetMax && (!value.budgetMin || Number(value.budgetMax)<Number(value.budgetMin))) {
    context.addIssue({ code: "custom", message: "The maximum budget must be at least the minimum budget." });
  }
});

export const finalTermsSchema = z.object({
  scope: text(10000),
  deliverables: z.array(text(500)).min(1).max(30),
  price: money,
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)), "Choose a valid deadline."),
  revisions: z.number().int().min(0).max(20),
  cancellationTerms: text(3000),
  confirmed: z.literal(true),
});
