import type { Repository } from "../db/repository";
import type { AuthProvider, AccountRole } from "./contracts";

export interface UserSession {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  role: AccountRole;
  providerEnabled: boolean;
}

export async function resolveUserSession(provider: AuthProvider, repository: Repository): Promise<UserSession | null> {
  const identity = await provider.currentIdentity();
  if (!identity) return null;
  const bundle = await repository.getProfileBundleByUserId(identity.userId);
  if (!bundle || bundle.profile.userId !== identity.userId) return null;
  const providerEnabled = bundle.providerProfile !== null;
  const role: AccountRole = identity.role === "ADMIN" ? "ADMIN" : providerEnabled ? "PROVIDER" : "CUSTOMER";
  return {
    ...identity,
    role,
    providerEnabled,
    username: bundle.profile.username,
    displayName: bundle.profile.displayName,
  };
}
