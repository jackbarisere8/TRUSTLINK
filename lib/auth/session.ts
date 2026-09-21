import type { Repository } from "../db/repository";
import type { AuthProvider, AccountRole } from "./contracts";

export interface UserSession {
  userId: string;
  email: string;
  username: string;
  displayName: string;
  role: AccountRole;
}

export async function resolveUserSession(provider: AuthProvider, repository: Repository): Promise<UserSession | null> {
  const identity = await provider.currentIdentity();
  if (!identity) return null;
  const applicationProfile = await repository.getProfileByUserId(identity.userId);
  if (!applicationProfile || applicationProfile.userId !== identity.userId) return null;
  return { ...identity, username: applicationProfile.username, displayName: applicationProfile.displayName };
}
