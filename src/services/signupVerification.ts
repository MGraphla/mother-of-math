import { supabase } from "@/lib/supabase";

/** Phone OTP is sent via SMS only (WhatsApp removed from product UI). */
export type SignupPhoneChannel = "sms";

function bodyErrorFrom(data: unknown): string {
  return data && typeof data === "object" && "error" in data
    ? String((data as { error: string }).error)
    : "";
}

function isInvokeTransportFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to send a request to the edge function") ||
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("load failed") ||
    m.includes("network request failed")
  );
}

/**
 * Calls `signup-verification` with `functions.invoke`, then falls back to a
 * plain `fetch` when the client reports a transport failure (common in some
 * browsers / SW / extension setups while the same URL works over fetch).
 */
export async function invokeSignupVerification(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const bodyStr = JSON.stringify(body);

  const { data, error } = await supabase.functions.invoke("signup-verification", {
    body,
  });

  const bodyError = bodyErrorFrom(data);

  if (!error) {
    const d = data as Record<string, unknown>;
    if (d && "ok" in d && d.ok === false) {
      throw new Error(bodyError || "Request failed.");
    }
    return d ?? {};
  }

  const primaryMsg =
    bodyError ||
    (error instanceof Error ? error.message : String(error)) ||
    "Verification service request failed.";

  if (!isInvokeTransportFailure(primaryMsg)) {
    throw new Error(primaryMsg);
  }

  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) {
    throw new Error(primaryMsg);
  }

  const url = `${base}/functions/v1/signup-verification`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anon}`,
        apikey: anon,
      },
      body: bodyStr,
    });
  } catch (e) {
    const extra = e instanceof Error ? e.message : String(e);
    throw new Error(`${primaryMsg} (${extra})`);
  }

  const text = await res.text();
  let parsed: Record<string, unknown>;
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(
      bodyError || `Edge function returned non-JSON (HTTP ${res.status}).`,
    );
  }

  const be = bodyErrorFrom(parsed);
  if (!res.ok) {
    throw new Error(be || `Edge function HTTP ${res.status}`);
  }
  if (parsed && "ok" in parsed && parsed.ok === false) {
    throw new Error(be || "Request failed.");
  }
  return parsed;
}

export async function signupVerificationRequest(
  body: Record<string, unknown>,
): Promise<void> {
  await invokeSignupVerification(body);
}
