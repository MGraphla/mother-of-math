import * as Network from "expo-network";

const NETWORK_HINT =
  "Your phone cannot reach the internet right now. Expo can still load over local Wi‑Fi even when that Wi‑Fi has no internet — but login needs a real connection to Supabase.\n\nTry:\n• Turn on mobile data, or use Wi‑Fi that has internet\n• Open Chrome on the phone and visit google.com\n• Turn Private DNS off (Android Settings → Network → Private DNS → Off)\n• Toggle Airplane mode off, then retry";

/** True when the OS reports an active path that can reach the internet. */
export const getIsInternetReachable = async (): Promise<boolean> => {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isInternetReachable != null) return state.isInternetReachable;
    return !!state.isConnected && state.type !== Network.NetworkStateType.NONE;
  } catch {
    return true; // Don't block login if the probe itself fails.
  }
};

/**
 * Maps raw fetch / OkHttp / DNS failures into an actionable message.
 * UnknownHostException means the phone's DNS cannot resolve supabase.co.
 */
export const toFriendlyNetworkError = (error: unknown): Error => {
  const raw =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : String(error ?? "");
  const msg = raw.toLowerCase();

  if (
    msg.includes("unknownhost") ||
    msg.includes("unable to resolve host") ||
    msg.includes("no address associated with hostname") ||
    msg.includes("err_name_not_resolved") ||
    msg.includes("getaddrinfo") ||
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("network error") ||
    msg.includes("timed out") ||
    msg.includes("timeout")
  ) {
    return new Error(NETWORK_HINT);
  }

  return error instanceof Error ? error : new Error(raw || "Network request failed.");
};

/**
 * Probes the configured Supabase host so we fail fast with a clear message
 * before auth runs. Uses a short timeout so a dead DNS doesn't hang the UI.
 */
export const assertSupabaseReachable = async (supabaseUrl: string): Promise<void> => {
  if (!supabaseUrl) {
    throw new Error("App is missing EXPO_PUBLIC_SUPABASE_URL. Check apps/mobile/.env and restart Expo.");
  }

  const online = await getIsInternetReachable();
  if (!online) {
    throw new Error(NETWORK_HINT);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    // /auth/v1/health is public; a DNS/network failure throws here.
    await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`, {
      method: "GET",
      signal: controller.signal,
    });
  } catch (error) {
    throw toFriendlyNetworkError(error);
  } finally {
    clearTimeout(timer);
  }
};

/** Wrap global fetch so Supabase client errors become readable on device. */
export const createFriendlyFetch = (): typeof fetch => {
  const friendlyFetch: typeof fetch = async (input, init) => {
    try {
      return await fetch(input, init);
    } catch (error) {
      throw toFriendlyNetworkError(error);
    }
  };
  return friendlyFetch;
};
