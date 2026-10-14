import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { resolveAvatarUrl } from "../lib/avatar";
import { getStudentSession } from "../services/studentPortal";

export interface DisplayIdentity {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

/**
 * Resolves who to show in the header and drawer. Learners who signed in with an
 * access token have no `profiles` row, so their name comes from the stored
 * student session instead.
 */
export const useDisplayIdentity = (): DisplayIdentity => {
  const { profile, user } = useAuth();
  const [studentName, setStudentName] = useState<string | null>(null);

  const hasProfileName = !!profile?.full_name;

  useEffect(() => {
    if (hasProfileName) return;
    let cancelled = false;
    getStudentSession()
      .then((s) => {
        if (!cancelled) setStudentName(s?.full_name ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasProfileName]);

  return {
    name: profile?.full_name ?? studentName,
    email: profile?.email ?? user?.email ?? null,
    avatarUrl: resolveAvatarUrl(profile, user),
  };
};
