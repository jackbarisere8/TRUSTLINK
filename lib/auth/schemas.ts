import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const signupSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(120),
  profession: z.string().trim().max(160).optional(),
});

export const confirmationSchema = z.object({
  tokenHash: z.string().min(1).max(2048),
  type: z.literal("email"),
});
