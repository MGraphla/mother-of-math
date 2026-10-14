import { Platform } from "react-native";

/**
 * Mobile Google OAuth bridge:
 * Google → Supabase → https://mamamath.org/auth/callback?app=motherofmath&code=…
 *   → (website forwards, does NOT exchange code)
 *   → motherofmath://auth/callback?code=…
 *   → app exchanges PKCE code and signs in.
 *
 * Also supported: /auth/mobile-callback (dedicated bounce page).
 */
const siteOrigin = (process.env.EXPO_PUBLIC_SITE_URL ?? "https://mamamath.org").replace(
  /\/$/,
  "",
);

/** Marked callback so the website knows to deep-link into the app. */
export const WEB_MOBILE_OAUTH_BRIDGE = `${siteOrigin}/auth/callback?app=motherofmath`;
export const WEB_MOBILE_OAUTH_BRIDGE_DEDICATED = `${siteOrigin}/auth/mobile-callback`;
export const APP_OAUTH_REDIRECT = "motherofmath://auth/callback";

export function getMobileOAuthRedirectTo(): string {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}/auth/callback`;
    }
  }

  const override = process.env.EXPO_PUBLIC_OAUTH_REDIRECT?.trim();
  if (override) return override;

  return WEB_MOBILE_OAUTH_BRIDGE;
}

/** Prefix watched by `openAuthSessionAsync` to close the in-app browser. */
export function getAuthSessionReturnUrl(redirectTo: string): string {
  if (redirectTo.startsWith("motherofmath://")) {
    return "motherofmath://";
  }
  // HTTPS bridge always finishes by navigating to the app scheme.
  return "motherofmath://";
}

export function withMobileOAuthRedirect(authorizeUrl: string, redirectTo: string): string {
  try {
    const url = new URL(authorizeUrl);
    url.searchParams.set("redirect_to", redirectTo);
    return url.toString();
  } catch {
    return authorizeUrl;
  }
}

export function readRedirectFromAuthorizeUrl(authorizeUrl: string): string {
  try {
    return new URL(authorizeUrl).searchParams.get("redirect_to") ?? "";
  } catch {
    return "";
  }
}
