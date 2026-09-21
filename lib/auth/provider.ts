import "server-only";
import type { AuthProvider } from "./contracts";
import { unconfiguredAuthProvider } from "./contracts";
import { resolveAuthConfiguration } from "./config";
import { supabaseAuthProvider } from "./supabase-provider";

export function getAuthProvider(): AuthProvider {
  return resolveAuthConfiguration(process.env).mode === "supabase" ? supabaseAuthProvider : unconfiguredAuthProvider;
}
