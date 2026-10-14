import type { User } from "@supabase/supabase-js";
import type { Profile } from "../context/AuthContext";

const pickString = (...values: unknown[]): string | null => {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
};

/**
 * Prefer the saved profile photo; fall back to Google/OAuth metadata when
 * `profiles.avatar_url` was never synced (common for Google sign-in).
 */
export const resolveAvatarUrl = (
  profile?: Profile | null,
  user?: User | null,
): string | null => {
  const fromProfile = pickString(profile?.avatar_url);
  if (fromProfile) return fromProfile;

  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const fromMeta = pickString(meta.avatar_url, meta.picture, meta.avatar);
  if (fromMeta) return fromMeta;

  for (const identity of user.identities ?? []) {
    const data = identity.identity_data ?? {};
    const fromIdentity = pickString(data.avatar_url, data.picture, data.avatar);
    if (fromIdentity) return fromIdentity;
  }

  return null;
};
