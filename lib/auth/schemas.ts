import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const signupSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(120),
});

export const confirmationSchema = z.object({
  tokenHash: z.string().min(1).max(2048),
  type: z.literal("email"),
});

export const passwordRecoveryRequestSchema = z.object({
  email: z.email().max(254).transform(value => value.toLowerCase()),
});

export const passwordUpdateSchema = z.object({
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine(input => input.password === input.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords must match.",
});

export const recoveryCallbackSchema = z.union([
  z.object({ code: z.string().min(1).max(4096) }),
  z.object({ tokenHash: z.string().min(1).max(4096), type: z.literal("recovery") }),
]);
