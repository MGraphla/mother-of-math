// Supabase Edge Function: general-purpose SMS notification.
// Reuses secrets: INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_SMS_FROM

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dialCountry(raw: string): "Cameroon" | "Nigeria" {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t === "nigeria" || t.includes("nigeria")) return "Nigeria";
  return "Cameroon";
}

function normalizeE164(phone: string, country: string): string {
  const cc = dialCountry(country);
  const digits = phone.replace(/\s+/g, "").replace(/-/g, "");
  if (cc === "Cameroon") {
    if (digits.startsWith("+237")) return digits;
    if (digits.startsWith("237")) return `+${digits}`;
    return `+237${digits.replace(/^0/, "")}`;
  }
  if (cc === "Nigeria") {
    if (digits.startsWith("+234")) return digits;
    if (digits.startsWith("234")) return `+${digits}`;
    if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
    return `+234${digits}`;
  }
  if (digits.startsWith("+")) return digits;
  return `+${digits}`;
}

function isPlausibleE164(n: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(n);
}

function normalizeInfobipBaseUrl(raw: string): string {
  const t = raw.trim().replace(/\/$/, "");
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) return `https://${t}`;
  return t;
}

function normalizeInfobipApiKey(raw: string): string {
  return raw.trim().replace(/^App\s+/i, "");
}

async function sendInfobipSms(
  baseUrl: string,
  apiKey: string,
  from: string,
  toE164: string,
  text: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, "")}/sms/2/text/advanced`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `App ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      messages: [{ from, destinations: [{ to: toE164 }], text }],
    }),
  });
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`SMS failed (${res.status}): ${errTxt.slice(0, 500)}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const infobipBase = normalizeInfobipBaseUrl(Deno.env.get("INFOBIP_BASE_URL") ?? "");
    const infobipKey = normalizeInfobipApiKey(Deno.env.get("INFOBIP_API_KEY") ?? "");
    const smsFrom = Deno.env.get("INFOBIP_SMS_FROM") ?? "";

    if (!infobipBase || !infobipKey || !smsFrom) {
      return json({ ok: false, error: "SMS is not configured on the server." });
    }

    const raw = await req.text().catch(() => "");
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    if (!body || typeof body !== "object") {
      return json({ ok: false, error: "Invalid JSON body." });
    }

    const b = body as Record<string, unknown>;
    const to = String(b.to ?? "").trim();
    const message = String(b.message ?? "").trim();
    const country = String(b.country ?? "Cameroon");

    if (!to) return json({ ok: false, error: "Phone number (to) is required." });
    if (!message) return json({ ok: false, error: "Message text is required." });
    if (message.length > 1600) return json({ ok: false, error: "Message too long (max 1600 chars)." });

    const destination = normalizeE164(to, country);
    if (!isPlausibleE164(destination)) {
      return json({ ok: false, error: "Invalid phone number." });
    }

    await sendInfobipSms(infobipBase, infobipKey, smsFrom, destination, message);

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({
      ok: false,
      error: e instanceof Error ? e.message : "Unexpected server error.",
    });
  }
});
