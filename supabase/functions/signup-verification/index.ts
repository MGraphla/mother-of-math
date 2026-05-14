// Supabase Edge Function: signup verification (SMS / WhatsApp).
// Secrets: INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_SMS_FROM, INFOBIP_WHATSAPP_FROM,
//         SIGNUP_OTP_PEPPER (optional but recommended)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const CODE_LENGTH = 6;

/** Short one-line OTP / reset SMS (minimize segments). */
function smsSignupOtp(code: string): string {
  return `MM ${code} 10m`;
}
function smsResetOtp(code: string): string {
  return `MM reset ${code} 10m`;
}

function json(body: unknown, _status = 200) {
  // Always return HTTP 200 so the Supabase JS SDK doesn't swallow the response body.
  // The actual success/failure is indicated by the `ok` field in the JSON body.
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomDigits(n: number): string {
  let s = "";
  const arr = new Uint32Array(n);
  crypto.getRandomValues(arr);
  for (let i = 0; i < n; i++) s += String(arr[i] % 10);
  return s;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function dialCountry(raw: string): "Cameroon" | "Nigeria" | "Other" {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t === "nigeria" || t.includes("nigeria") || t === "ng") return "Nigeria";
  if (t === "cameroon" || t.includes("cameroon") || t === "cm") return "Cameroon";
  return "Other";
}

function normalizeE164(phone: string, country: string): string {
  const cc = dialCountry(country);
  const digits = phone.replace(/\s+/g, "").replace(/-/g, "");
  if (cc === "Cameroon") {
    if (digits.startsWith("+237")) return digits;
    if (digits.startsWith("237")) return `+${digits}`;
    const national = digits.replace(/^0/, "");
    return `+237${national}`;
  }
  if (cc === "Nigeria") {
    if (digits.startsWith("+234")) return digits;
    if (digits.startsWith("234")) return `+${digits}`;
    if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
    return `+234${digits}`;
  }
  // "Other" — require explicit international format (must include +).
  if (digits.startsWith("+")) return digits;
  return `+${digits.replace(/^0+/, "")}`;
}

function isPlausibleE164(n: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(n);
}

/** Accepts API base host with or without https:// (from SMS provider env). */
function normalizeInfobipBaseUrl(raw: string): string {
  const t = raw.trim().replace(/\/$/, "");
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) return `https://${t}`;
  return t;
}

/** API key only (no `App ` prefix); header is built as `App ${key}`. */
function normalizeInfobipApiKey(raw: string): string {
  return raw.trim().replace(/^App\s+/i, "");
}

type ProfilePayload = {
  full_name?: string;
  role?: string;
  gender?: string | null;
  country?: string | null;
  city?: string | null;
  school_name?: string | null;
  school_address?: string | null;
  school_type?: string | null;
  number_of_students?: number | null;
  number_of_classes?: number | null;
  subjects_taught?: string | null;
  grade_levels?: string | null;
  years_of_experience?: number | null;
  education_level?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  bio?: string | null;
  date_of_birth?: string | null;
  preferred_language?: string | null;
};

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
    throw new Error(`SMS send failed (${res.status}): ${errTxt.slice(0, 500)}`);
  }
}

async function sendInfobipWhatsappText(
  baseUrl: string,
  apiKey: string,
  from: string,
  toE164: string,
  text: string,
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, "")}/whatsapp/1/message/text`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `App ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from,
      to: toE164,
      content: { text },
    }),
  });
  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(
      `WhatsApp send failed (${res.status}): ${errTxt.slice(0, 500)}`,
    );
  }
}

/** Look up a single auth user by email using the GoTrue REST API (the JS SDK `listUsers` has no email filter). */
async function findUserByEmail(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
): Promise<{ id: string; emailConfirmed: boolean } | null> {
  let page = 1;
  const perPage = 50;
  const target = email.toLowerCase();
  while (true) {
    const url = `${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const users: Array<{ id: string; email?: string; email_confirmed_at?: string }> =
      data.users ?? [];
    if (users.length === 0) return null;
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) {
      return { id: match.id, emailConfirmed: !!match.email_confirmed_at };
    }
    if (users.length < perPage) return null;
    page++;
  }
}

/**
 * Returns an error message if any target E.164 is already used on another account
 * (profiles or another pending signup challenge). Same auth user may re-verify (excludeAuthUserId).
 */
async function assertPhonesNotRegisteredElsewhere(
  admin: ReturnType<typeof createClient>,
  countryFallback: string,
  targets: string[],
  currentEmailNorm: string,
  excludeAuthUserId: string | null,
): Promise<string | null> {
  const seen = new Set<string>();
  for (const target of targets) {
    if (!isPlausibleE164(target) || seen.has(target)) continue;
    seen.add(target);

    const { data: ch } = await admin
      .from("signup_phone_verification_challenges")
      .select("email")
      .eq("destination_e164", target)
      .neq("email", currentEmailNorm)
      .limit(1)
      .maybeSingle();

    if (ch) {
      return "This phone number is already in use. Please sign in or use a different number.";
    }

    const digits8 = target.replace(/\D/g, "").slice(-8);
    if (digits8.length < 8) continue;

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, phone_number, whatsapp_number, country")
      .or(`phone_number.ilike.%${digits8},whatsapp_number.ilike.%${digits8}`)
      .limit(15);

    for (const p of profiles ?? []) {
      if (excludeAuthUserId && p.id === excludeAuthUserId) continue;
      const pCountry = (p.country as string) || countryFallback;
      const smsNum = p.phone_number ? normalizeE164(String(p.phone_number), pCountry) : "";
      const waNum = p.whatsapp_number ? normalizeE164(String(p.whatsapp_number), pCountry) : "";
      if (smsNum === target || waNum === target) {
        return "This phone number is already registered. Please sign in or use a different number.";
      }
    }
  }
  return null;
}

function collectSignupPhoneTargets(
  country: string,
  rawDestination: string | undefined,
  profile: Pick<ProfilePayload, "phone_number" | "whatsapp_number">,
): string[] {
  const targets: string[] = [];
  const add = (raw: string | null | undefined) => {
    if (raw == null || String(raw).trim() === "") return;
    const n = normalizeE164(String(raw).trim(), country);
    if (isPlausibleE164(n) && !targets.includes(n)) targets.push(n);
  };
  add(rawDestination);
  add(profile.phone_number ?? undefined);
  add(profile.whatsapp_number ?? undefined);
  return targets;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const infobipBase = normalizeInfobipBaseUrl(Deno.env.get("INFOBIP_BASE_URL") ?? "");
    const infobipKey = normalizeInfobipApiKey(Deno.env.get("INFOBIP_API_KEY") ?? "");
    const smsFrom = Deno.env.get("INFOBIP_SMS_FROM") ?? "";
    // Separate sender ID used for password-reset SMS so it's visually distinct from signup OTPs.
    // Falls back to the regular smsFrom if the dedicated secret isn't set.
    const recoveryFrom = Deno.env.get("INFOBIP_SMS_RECOVERY_FROM") || smsFrom;
    const waFrom = Deno.env.get("INFOBIP_WHATSAPP_FROM") ?? "";
    const pepper = Deno.env.get("SIGNUP_OTP_PEPPER") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: "Server misconfigured (Supabase)." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // req.json() has been unreliable in some Edge Runtime deployments; parse via text instead.
    const raw = await req.text().catch(() => "");
    let body: unknown = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    if (!body || typeof body !== "object") {
      return json(
        {
          ok: false,
          error: "Invalid JSON body.",
        },
        400,
      );
    }

    // Some clients/proxies double-wrap: { "body": { "action": "...", ... } }
    const top = body as Record<string, unknown>;
    if (
      top.body &&
      typeof top.body === "object" &&
      !("action" in top) &&
      "action" in (top.body as Record<string, unknown>)
    ) {
      body = top.body;
    }

    const b = body as Record<string, unknown>;
    const rawAction = b.action;
    const action =
      typeof rawAction === "string"
        ? rawAction.trim().toLowerCase()
        : rawAction == null
          ? ""
          : String(rawAction).trim().toLowerCase();

    if (action === "check_signup_availability") {
      const email = normalizeEmail(String((body as Record<string, unknown>).email ?? ""));
      const country = String((body as Record<string, unknown>).country ?? "Cameroon");
      const rawPhone = String((body as Record<string, unknown>).phone_number ?? "").trim();
      const rawWa = String((body as Record<string, unknown>).whatsapp_number ?? "").trim();

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ ok: false, error: "Valid email is required." }, 400);
      }

      const existing = await findUserByEmail(supabaseUrl, serviceKey, email);
      if (existing?.emailConfirmed) {
        return json({
          ok: false,
          error: "This email is already registered. Please sign in instead.",
        });
      }
      if (existing && !existing.emailConfirmed) {
        return json({
          ok: false,
          error:
            "A registration is already in progress for this email. Check your verification message or try again later.",
        });
      }

      const targets = collectSignupPhoneTargets(country, undefined, {
        phone_number: rawPhone || null,
        whatsapp_number: rawWa || null,
      });

      if (targets.length > 0) {
        const phoneErr = await assertPhonesNotRegisteredElsewhere(
          admin,
          country,
          targets,
          email,
          null,
        );
        if (phoneErr) return json({ ok: false, error: phoneErr });
      }

      return json({ ok: true });
    }

    if (action === "start") {
      if (!infobipBase || !infobipKey) {
        return json({ ok: false, error: "Verification messaging is not configured on the server." }, 500);
      }

      const email = normalizeEmail(String((body as Record<string, unknown>).email ?? ""));
      const password = String((body as Record<string, unknown>).password ?? "");
      const channel = String((body as Record<string, unknown>).channel ?? "") as
        | "sms"
        | "whatsapp";
      const country = String((body as Record<string, unknown>).country ?? "Cameroon");
      const rawDestination = String((body as Record<string, unknown>).destination ?? "");
      const profile = ((body as Record<string, unknown>).profile ?? {}) as ProfilePayload;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ ok: false, error: "Valid email is required." }, 400);
      }
      if (password.length < 8) {
        return json({ ok: false, error: "Password must be at least 8 characters." }, 400);
      }
      if (channel !== "sms" && channel !== "whatsapp") {
        return json({ ok: false, error: "Channel must be sms or whatsapp." }, 400);
      }
      const destination = normalizeE164(rawDestination, country);
      if (!isPlausibleE164(destination)) {
        return json({ ok: false, error: "Invalid phone number." }, 400);
      }
      if (channel === "sms" && !smsFrom) {
        return json({ ok: false, error: "SMS sender is not configured." }, 500);
      }
      if (channel === "whatsapp" && !waFrom) {
        return json({ ok: false, error: "WhatsApp sender is not configured." }, 500);
      }

      const existingBeforeCreate = await findUserByEmail(supabaseUrl, serviceKey, email);
      if (existingBeforeCreate?.emailConfirmed) {
        return json({
          ok: false,
          error: "This email is already registered. Please sign in instead.",
        });
      }

      const phoneTargets = collectSignupPhoneTargets(country, rawDestination, profile);
      const phoneConflict = await assertPhonesNotRegisteredElsewhere(
        admin,
        country,
        phoneTargets,
        email,
        existingBeforeCreate?.id ?? null,
      );
      if (phoneConflict) {
        return json({ ok: false, error: phoneConflict });
      }

      const userMetadata: Record<string, unknown> = {
        full_name: profile.full_name ?? "",
        role: profile.role ?? "teacher",
        gender: profile.gender ?? null,
        country: profile.country ?? null,
        city: profile.city ?? null,
        school_name: profile.school_name ?? null,
        school_address: profile.school_address ?? null,
        school_type: profile.school_type ?? null,
        number_of_students: profile.number_of_students ?? null,
        number_of_classes: profile.number_of_classes ?? null,
        subjects_taught: profile.subjects_taught ?? null,
        grade_levels: profile.grade_levels ?? null,
        years_of_experience: profile.years_of_experience ?? null,
        education_level: profile.education_level ?? null,
        phone_number: profile.phone_number ?? null,
        whatsapp_number: profile.whatsapp_number ?? null,
        bio: profile.bio ?? null,
        date_of_birth: profile.date_of_birth ?? null,
        preferred_language: profile.preferred_language ?? null,
      };

      let userId: string;

      // Try creating the user first; handle duplicate gracefully.
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: userMetadata,
      });

      if (createErr) {
        const msg = (createErr.message ?? "").toLowerCase();
        const isDuplicate =
          msg.includes("already") || msg.includes("registered") || msg.includes("exists") || msg.includes("duplicate");
        if (!isDuplicate) {
          return json({ ok: false, error: createErr.message ?? "Could not create user." }, 400);
        }

        // User already exists — check if fully confirmed.
        const existing = await findUserByEmail(supabaseUrl, serviceKey, email);
        if (!existing) {
          return json({ ok: false, error: "An account with this email already exists. Please sign in instead." }, 400);
        }
        if (existing.emailConfirmed) {
          return json({ ok: false, error: "An account with this email already exists. Please sign in instead." }, 400);
        }
        // Unconfirmed user — update password/metadata and re-send OTP.
        userId = existing.id;
        const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: false,
          user_metadata: userMetadata,
        });
        if (updErr) {
          return json({ ok: false, error: updErr.message }, 400);
        }
      } else {
        if (!created.user?.id) {
          return json({ ok: false, error: "User creation returned no id." }, 500);
        }
        userId = created.user.id;
      }

      const code = randomDigits(CODE_LENGTH);
      const codeHash = await sha256Hex(`${pepper}:${email}:${code}`);

      await admin.from("signup_phone_verification_challenges").delete().eq("email", email);

      const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
      const { error: insErr } = await admin.from("signup_phone_verification_challenges").insert({
        user_id: userId,
        email,
        channel,
        destination_e164: destination,
        code_hash: codeHash,
        attempts: 0,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });

      if (insErr) {
        console.error(insErr);
        return json({ ok: false, error: "Could not store verification challenge." }, 500);
      }

      const msgText = smsSignupOtp(code);

      try {
        if (channel === "sms") {
          await sendInfobipSms(infobipBase, infobipKey, smsFrom, destination, msgText);
        } else {
          await sendInfobipWhatsappText(infobipBase, infobipKey, waFrom, destination, msgText);
        }
      } catch (e) {
        console.error(e);
        await admin.from("signup_phone_verification_challenges").delete().eq("email", email);
        return json({
          ok: false,
          error: e instanceof Error ? e.message : "Failed to send verification message.",
        }, 502);
      }

      return json({ ok: true });
    }

    if (action === "verify") {
      const email = normalizeEmail(String((body as Record<string, unknown>).email ?? ""));
      const code = String((body as Record<string, unknown>).code ?? "").replace(/\D/g, "");

      if (!email || code.length < CODE_LENGTH) {
        return json({ ok: false, error: "Email and code are required." }, 400);
      }

      const { data: row, error: fetchErr } = await admin
        .from("signup_phone_verification_challenges")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (fetchErr || !row) {
        return json({ ok: false, error: "No verification is pending for this email." }, 400);
      }

      if (new Date(row.expires_at as string).getTime() < Date.now()) {
        return json({ ok: false, error: "This code has expired. Request a new one." }, 400);
      }

      if ((row.attempts as number) >= MAX_ATTEMPTS) {
        return json({ ok: false, error: "Too many attempts. Please start sign-up again." }, 429);
      }

      const expected = await sha256Hex(`${pepper}:${email}:${code}`);
      if (expected !== row.code_hash) {
        await admin
          .from("signup_phone_verification_challenges")
          .update({
            attempts: (row.attempts as number) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("email", email);
        return json({ ok: false, error: "Invalid verification code." }, 400);
      }

      const { error: confirmErr } = await admin.auth.admin.updateUserById(row.user_id as string, {
        email_confirm: true,
      });

      if (confirmErr) {
        console.error(confirmErr);
        return json({ ok: false, error: confirmErr.message }, 500);
      }

      await admin.from("signup_phone_verification_challenges").delete().eq("email", email);

      return json({ ok: true });
    }

    if (action === "resend") {
      if (!infobipBase || !infobipKey) {
        return json({ ok: false, error: "Verification messaging is not configured on the server." }, 500);
      }

      const email = normalizeEmail(String((body as Record<string, unknown>).email ?? ""));
      const channel = String((body as Record<string, unknown>).channel ?? "") as
        | "sms"
        | "whatsapp";
      const country = String((body as Record<string, unknown>).country ?? "Cameroon");
      const rawDestination = String((body as Record<string, unknown>).destination ?? "");

      if (!email || (channel !== "sms" && channel !== "whatsapp")) {
        return json({ ok: false, error: "Email and channel are required." }, 400);
      }
      const destination = normalizeE164(rawDestination, country);
      if (!isPlausibleE164(destination)) {
        return json({ ok: false, error: "Invalid phone number." }, 400);
      }
      if (channel === "sms" && !smsFrom) {
        return json({ ok: false, error: "SMS sender is not configured." }, 500);
      }
      if (channel === "whatsapp" && !waFrom) {
        return json({ ok: false, error: "WhatsApp sender is not configured." }, 500);
      }

      const { data: row, error: fetchErr } = await admin
        .from("signup_phone_verification_challenges")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (fetchErr || !row) {
        return json({ ok: false, error: "No pending verification for this email." }, 400);
      }

      const existing = await findUserByEmail(supabaseUrl, serviceKey, email);
      if (!existing || existing.emailConfirmed) {
        await admin.from("signup_phone_verification_challenges").delete().eq("email", email);
        return json({ ok: false, error: "No pending verification for this email." }, 400);
      }

      const code = randomDigits(CODE_LENGTH);
      const codeHash = await sha256Hex(`${pepper}:${email}:${code}`);
      const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

      await admin
        .from("signup_phone_verification_challenges")
        .update({
          channel,
          destination_e164: destination,
          code_hash: codeHash,
          attempts: 0,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      const msgText = smsSignupOtp(code);

      try {
        if (channel === "sms") {
          await sendInfobipSms(infobipBase, infobipKey, smsFrom, destination, msgText);
        } else {
          await sendInfobipWhatsappText(infobipBase, infobipKey, waFrom, destination, msgText);
        }
      } catch (e) {
        console.error(e);
        return json({
          ok: false,
          error: e instanceof Error ? e.message : "Failed to send verification message.",
        }, 502);
      }

      return json({ ok: true });
    }

    // ──────────────────────────────────────────────────────────
    // PASSWORD RESET via phone (SMS / WhatsApp)
    // ──────────────────────────────────────────────────────────

    if (action === "start_password_reset") {
      if (!infobipBase || !infobipKey) {
        return json({ ok: false, error: "Verification messaging is not configured on the server." }, 500);
      }

      const email = normalizeEmail(String((body as Record<string, unknown>).email ?? ""));
      // "auto" (default) = server picks best channel from the user's profile.
      const requestedChannel = String((body as Record<string, unknown>).channel ?? "auto");
      const country = String((body as Record<string, unknown>).country ?? "Cameroon");

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ ok: false, error: "Valid email is required." }, 400);
      }

      // Find the user by email to verify they exist.
      const existingUser = await findUserByEmail(supabaseUrl, serviceKey, email);
      if (!existingUser) {
        // Generic ok to avoid email enumeration — caller shows no-phone message.
        return json({ ok: true, masked_phone: null, channel_used: null });
      }

      // Look up the registered phone numbers from the user's profile.
      const { data: profileRow } = await admin
        .from("profiles")
        .select("phone_number, whatsapp_number, country")
        .eq("id", existingUser.id)
        .maybeSingle();

      const smsPhone: string = profileRow?.phone_number ?? "";
      const waPhone: string = profileRow?.whatsapp_number ?? "";
      const resolvedCountry: string = profileRow?.country ?? country;

      // Auto-detect best channel: prefer explicit request, fall back to whatever is stored.
      let channel: "sms" | "whatsapp";
      let rawPhone: string;

      if (requestedChannel === "whatsapp") {
        rawPhone = waPhone || smsPhone;
        channel = rawPhone === waPhone && waPhone ? "whatsapp" : "sms";
      } else if (requestedChannel === "sms") {
        rawPhone = smsPhone || waPhone;
        channel = rawPhone === smsPhone && smsPhone ? "sms" : "whatsapp";
      } else {
        // "auto": SMS if phone_number exists, WhatsApp if only whatsapp_number exists.
        if (smsPhone && smsFrom) {
          rawPhone = smsPhone;
          channel = "sms";
        } else if (waPhone && waFrom) {
          rawPhone = waPhone;
          channel = "whatsapp";
        } else {
          rawPhone = smsPhone || waPhone;
          channel = smsPhone ? "sms" : "whatsapp";
        }
      }

      if (!rawPhone) {
        return json({ ok: false, error: "No phone number is registered for this account. Please use the email option." }, 400);
      }

      if (channel === "sms" && !smsFrom) {
        // Fall back to WhatsApp if SMS not configured but user has a WA number.
        if (waPhone && waFrom) { rawPhone = waPhone; channel = "whatsapp"; }
        else return json({ ok: false, error: "SMS is not configured on the server." }, 500);
      }
      if (channel === "whatsapp" && !waFrom) {
        if (smsPhone && smsFrom) { rawPhone = smsPhone; channel = "sms"; }
        else return json({ ok: false, error: "WhatsApp is not configured on the server." }, 500);
      }

      const destination = normalizeE164(rawPhone, resolvedCountry);
      if (!isPlausibleE164(destination)) {
        return json({ ok: false, error: "The phone number on your account is invalid. Please use the email option." }, 400);
      }

      const code = randomDigits(CODE_LENGTH);
      const codeHash = await sha256Hex(`${pepper}:${email}:${code}`);

      // Delete any existing challenge for this email (regardless of purpose).
      await admin.from("signup_phone_verification_challenges").delete().eq("email", email);

      const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
      // Insert challenge — try with purpose column first, fall back if column doesn't exist yet.
      const challengeRow: Record<string, unknown> = {
        user_id: existingUser.id,
        email,
        channel,
        destination_e164: destination,
        code_hash: codeHash,
        attempts: 0,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      };

      let { error: insErr } = await admin.from("signup_phone_verification_challenges").insert({ ...challengeRow, purpose: "password_reset" });
      if (insErr && (insErr.message?.includes("purpose") || insErr.code === "42703")) {
        // purpose column not yet migrated — insert without it
        const r2 = await admin.from("signup_phone_verification_challenges").insert(challengeRow);
        insErr = r2.error;
      }

      if (insErr) {
        console.error(insErr);
        return json({ ok: false, error: "Could not store verification challenge." }, 500);
      }

      const msgText = smsResetOtp(code);

      try {
        if (channel === "sms") {
          await sendInfobipSms(infobipBase, infobipKey, recoveryFrom, destination, msgText);
        } else {
          await sendInfobipWhatsappText(infobipBase, infobipKey, waFrom, destination, msgText);
        }
      } catch (e) {
        console.error(e);
        await admin.from("signup_phone_verification_challenges").delete().eq("email", email);
        return json({
          ok: false,
          error: e instanceof Error ? e.message : "Failed to send verification message.",
        }, 502);
      }

      // Build a masked phone for the frontend to display (e.g. +237 ••••• 1234).
      const digits = destination.replace(/\D/g, "");
      const cc = digits.slice(0, Math.min(4, digits.length - 6));
      const tail = digits.slice(-4);
      const masked = `+${cc} ••••• ${tail}`;

      return json({ ok: true, masked_phone: masked, channel_used: channel });
    }

    if (action === "resend_password_reset") {
      if (!infobipBase || !infobipKey) {
        return json({ ok: false, error: "Verification messaging is not configured on the server." }, 500);
      }

      const email = normalizeEmail(String((body as Record<string, unknown>).email ?? ""));
      const channel = (String((body as Record<string, unknown>).channel ?? "sms")) as "sms" | "whatsapp";
      const country = String((body as Record<string, unknown>).country ?? "Cameroon");

      if (!email || (channel !== "sms" && channel !== "whatsapp")) {
        return json({ ok: false, error: "Email and channel are required." }, 400);
      }
      if (channel === "sms" && !smsFrom) {
        return json({ ok: false, error: "SMS sender is not configured." }, 500);
      }
      if (channel === "whatsapp" && !waFrom) {
        return json({ ok: false, error: "WhatsApp sender is not configured." }, 500);
      }

      const { data: row, error: fetchErr } = await admin
        .from("signup_phone_verification_challenges")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (fetchErr || !row) {
        return json({ ok: false, error: "No pending password reset for this email." }, 400);
      }

      // Determine destination: re-lookup from profile for the potentially different channel.
      const { data: profileRow } = await admin
        .from("profiles")
        .select("phone_number, whatsapp_number, country")
        .eq("id", row.user_id as string)
        .maybeSingle();

      const rawPhone: string =
        channel === "whatsapp"
          ? (profileRow?.whatsapp_number ?? profileRow?.phone_number ?? "")
          : (profileRow?.phone_number ?? profileRow?.whatsapp_number ?? "");

      const resolvedCountry: string = profileRow?.country ?? country;
      const destination = rawPhone
        ? normalizeE164(rawPhone, resolvedCountry)
        : (row.destination_e164 as string);

      if (!isPlausibleE164(destination)) {
        return json({ ok: false, error: "Invalid phone number." }, 400);
      }

      const code = randomDigits(CODE_LENGTH);
      const codeHash = await sha256Hex(`${pepper}:${email}:${code}`);
      const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

      await admin
        .from("signup_phone_verification_challenges")
        .update({
          channel,
          destination_e164: destination,
          code_hash: codeHash,
          attempts: 0,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      const msgText = smsResetOtp(code);

      try {
        if (channel === "sms") {
          await sendInfobipSms(infobipBase, infobipKey, recoveryFrom, destination, msgText);
        } else {
          await sendInfobipWhatsappText(infobipBase, infobipKey, waFrom, destination, msgText);
        }
      } catch (e) {
        console.error(e);
        return json({
          ok: false,
          error: e instanceof Error ? e.message : "Failed to send verification message.",
        }, 502);
      }

      return json({ ok: true, channel_used: channel });
    }

    if (action === "verify_password_reset") {
      const email = normalizeEmail(String((body as Record<string, unknown>).email ?? ""));
      const code = String((body as Record<string, unknown>).code ?? "").replace(/\D/g, "");
      const redirectTo = String((body as Record<string, unknown>).redirect_to ?? `${supabaseUrl.replace("/rest/v1", "")}`);

      if (!email || code.length < CODE_LENGTH) {
        return json({ ok: false, error: "Email and code are required." }, 400);
      }

      const { data: row, error: fetchErr } = await admin
        .from("signup_phone_verification_challenges")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (fetchErr || !row) {
        return json({ ok: false, error: "No pending password reset for this email." }, 400);
      }

      if (new Date(row.expires_at as string).getTime() < Date.now()) {
        return json({ ok: false, error: "This code has expired. Please request a new one." }, 400);
      }

      if ((row.attempts as number) >= MAX_ATTEMPTS) {
        return json({ ok: false, error: "Too many attempts. Please start again." }, 429);
      }

      const expected = await sha256Hex(`${pepper}:${email}:${code}`);
      if (expected !== row.code_hash) {
        await admin
          .from("signup_phone_verification_challenges")
          .update({
            attempts: (row.attempts as number) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("email", email);
        return json({ ok: false, error: "Invalid verification code." }, 400);
      }

      // Code is valid — generate a one-time recovery link so the user can set a new password.
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });

      if (linkErr || !linkData?.properties?.action_link) {
        console.error(linkErr);
        return json({ ok: false, error: "Could not generate password reset link. Please try again." }, 500);
      }

      // Clean up the challenge row.
      await admin.from("signup_phone_verification_challenges").delete().eq("email", email);

      return json({ ok: true, recovery_url: linkData.properties.action_link });
    }

    // ──────────────────────────────────────────────────────────
    // PHONE-BASED PASSWORD RESET  (look up account by phone)
    // ──────────────────────────────────────────────────────────

    if (action === "start_password_reset_by_phone") {
      if (!infobipBase || !infobipKey) {
        return json({ ok: false, error: "SMS service is not configured on the server." });
      }

      const rawPhone = String((body as Record<string, unknown>).phone ?? "").trim();
      const country   = String((body as Record<string, unknown>).country ?? "Cameroon");
      const channel   = (String((body as Record<string, unknown>).channel ?? "sms")) as "sms" | "whatsapp";

      if (!rawPhone) {
        return json({ ok: false, error: "Phone number is required." });
      }
      if (channel === "sms" && !smsFrom) {
        return json({ ok: false, error: "SMS sender is not configured." });
      }
      if (channel === "whatsapp" && !waFrom) {
        return json({ ok: false, error: "WhatsApp sender is not configured." });
      }

      const targetE164 = normalizeE164(rawPhone, country);
      if (!isPlausibleE164(targetE164)) {
        return json({ ok: false, error: "Please enter a valid phone number." });
      }

      // Search profiles using the last 8 digits as a suffix (handles stored formats).
      const digits8 = targetE164.replace(/\D/g, "").slice(-8);

      const { data: profiles } = await admin
        .from("profiles")
        .select("id, email, phone_number, whatsapp_number, country")
        .or(`phone_number.ilike.%${digits8},whatsapp_number.ilike.%${digits8}`)
        .limit(10);

      // Find the exact match by normalising stored numbers.
      let matchedProfile: { id: string; email: string; resolvedChannel: "sms" | "whatsapp" } | null = null;
      for (const p of (profiles ?? [])) {
        const pCountry = (p.country as string) || country;
        const smsNum  = p.phone_number    ? normalizeE164(String(p.phone_number),    pCountry) : "";
        const waNum   = p.whatsapp_number ? normalizeE164(String(p.whatsapp_number), pCountry) : "";
        if (smsNum === targetE164) {
          matchedProfile = { id: p.id as string, email: p.email as string, resolvedChannel: "sms" };
          break;
        }
        if (waNum === targetE164) {
          matchedProfile = { id: p.id as string, email: p.email as string, resolvedChannel: "whatsapp" };
          break;
        }
      }

      if (!matchedProfile) {
        return json({ ok: false, error: "No account is linked to this phone number." });
      }

      // Must match verify_and_set_password / resend: hash and DB row use lowercase email.
      const emailKey = normalizeEmail(matchedProfile.email);

      // Prefer the requested channel; fall back to whichever one is registered.
      const resolvedChannel = channel;

      const code     = randomDigits(CODE_LENGTH);
      const codeHash = await sha256Hex(`${pepper}:${emailKey}:${code}`);
      const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

      await admin.from("signup_phone_verification_challenges").delete().eq("user_id", matchedProfile.id);

      // Insert challenge — try with purpose column, fall back without it if not yet migrated.
      const phoneChallenge: Record<string, unknown> = {
        user_id:          matchedProfile.id,
        email:            emailKey,
        channel:          resolvedChannel,
        destination_e164: targetE164,
        code_hash:        codeHash,
        attempts:         0,
        expires_at:       expiresAt,
        updated_at:       new Date().toISOString(),
      };
      let { error: insErr } = await admin.from("signup_phone_verification_challenges").insert({ ...phoneChallenge, purpose: "password_reset" });
      if (insErr && (insErr.message?.includes("purpose") || insErr.code === "42703")) {
        const r2 = await admin.from("signup_phone_verification_challenges").insert(phoneChallenge);
        insErr = r2.error;
      }

      if (insErr) {
        console.error(insErr);
        return json({ ok: false, error: "Could not create verification challenge." });
      }

      const msgText = smsResetOtp(code);

      try {
        if (resolvedChannel === "sms") {
          await sendInfobipSms(infobipBase, infobipKey, recoveryFrom, targetE164, msgText);
        } else {
          await sendInfobipWhatsappText(infobipBase, infobipKey, waFrom, targetE164, msgText);
        }
      } catch (e) {
        console.error(e);
        await admin.from("signup_phone_verification_challenges").delete().eq("user_id", matchedProfile.id);
        return json({ ok: false, error: e instanceof Error ? e.message : "Failed to send verification message." });
      }

      // Masked phone for display (e.g.  +237 ••••• 5678).
      const d   = targetE164.replace(/\D/g, "");
      const cc  = d.slice(0, Math.min(4, d.length - 6));
      const tail = d.slice(-4);

      return json({
        ok:           true,
        masked_phone: `+${cc} ••••• ${tail}`,
        channel_used: resolvedChannel,
        // email_token is the challenge key the frontend must pass to verify_and_set_password.
        email_token:  emailKey,
      });
    }

    // ──────────────────────────────────────────────────────────
    // VERIFY OTP + SET NEW PASSWORD  (completes phone-based reset)
    // ──────────────────────────────────────────────────────────

    // ──────────────────────────────────────────────────────────
    // VERIFY OTP ONLY (no password change)
    // Used by the UI to validate the code before showing the
    // password form. Wrong codes increment attempts; correct
    // codes do nothing (the next call to verify_and_set_password
    // does the real work and consumes the challenge).
    // ──────────────────────────────────────────────────────────

    if (action === "verify_password_reset_otp") {
      const emailToken = normalizeEmail(String((body as Record<string, unknown>).email_token ?? ""));
      const code       = String((body as Record<string, unknown>).code ?? "").replace(/\D/g, "");

      if (!emailToken || code.length < CODE_LENGTH) {
        return json({ ok: false, error: "Verification code is required." });
      }

      let { data: row, error: fetchErr } = await admin
        .from("signup_phone_verification_challenges")
        .select("*")
        .eq("email", emailToken)
        .maybeSingle();

      if (!fetchErr && !row) {
        const r2 = await admin
          .from("signup_phone_verification_challenges")
          .select("*")
          .ilike("email", emailToken)
          .maybeSingle();
        row = r2.data;
        fetchErr = r2.error;
      }

      if (fetchErr || !row) {
        return json({ ok: false, error: "No pending password reset for this session. Please start again." });
      }

      const rowEmailRaw = String(row.email ?? "");
      const rowEmailKey = normalizeEmail(rowEmailRaw);

      if (new Date(row.expires_at as string).getTime() < Date.now()) {
        return json({ ok: false, error: "This code has expired. Please request a new one." });
      }
      if ((row.attempts as number) >= MAX_ATTEMPTS) {
        return json({ ok: false, error: "Too many incorrect attempts. Please start again." });
      }

      const expectedKey = await sha256Hex(`${pepper}:${rowEmailKey}:${code}`);
      const expectedRaw = await sha256Hex(`${pepper}:${rowEmailRaw}:${code}`);
      const codeOk = expectedKey === row.code_hash || expectedRaw === row.code_hash;

      if (!codeOk) {
        await admin
          .from("signup_phone_verification_challenges")
          .update({ attempts: (row.attempts as number) + 1, updated_at: new Date().toISOString() })
          .eq("email", rowEmailRaw);
        const remaining = MAX_ATTEMPTS - ((row.attempts as number) + 1);
        return json({ ok: false, error: `Invalid code. ${remaining > 0 ? `${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` : "No attempts remaining."}` });
      }

      return json({ ok: true });
    }

    if (action === "verify_and_set_password") {
      const emailToken  = normalizeEmail(String((body as Record<string, unknown>).email_token ?? ""));
      const code        = String((body as Record<string, unknown>).code ?? "").replace(/\D/g, "");
      const newPassword = String((body as Record<string, unknown>).new_password ?? "");

      if (!emailToken || code.length < CODE_LENGTH) {
        return json({ ok: false, error: "Verification code is required." });
      }
      if (newPassword.length < 8) {
        return json({ ok: false, error: "Password must be at least 8 characters." });
      }

      let { data: row, error: fetchErr } = await admin
        .from("signup_phone_verification_challenges")
        .select("*")
        .eq("email", emailToken)
        .maybeSingle();

      // Legacy rows may store mixed-case email; ilike matches case-insensitively.
      if (!fetchErr && !row) {
        const r2 = await admin
          .from("signup_phone_verification_challenges")
          .select("*")
          .ilike("email", emailToken)
          .maybeSingle();
        row = r2.data;
        fetchErr = r2.error;
      }

      if (fetchErr || !row) {
        return json({ ok: false, error: "No pending password reset for this session. Please start again." });
      }

      const rowEmailRaw = String(row.email ?? "");
      const rowEmailKey = normalizeEmail(rowEmailRaw);

      if (new Date(row.expires_at as string).getTime() < Date.now()) {
        return json({ ok: false, error: "This code has expired. Please request a new one." });
      }

      if ((row.attempts as number) >= MAX_ATTEMPTS) {
        return json({ ok: false, error: "Too many incorrect attempts. Please start again." });
      }

      const expectedKey = await sha256Hex(`${pepper}:${rowEmailKey}:${code}`);
      const expectedRaw = await sha256Hex(`${pepper}:${rowEmailRaw}:${code}`);
      const codeOk = expectedKey === row.code_hash || expectedRaw === row.code_hash;
      if (!codeOk) {
        await admin
          .from("signup_phone_verification_challenges")
          .update({ attempts: (row.attempts as number) + 1, updated_at: new Date().toISOString() })
          .eq("email", rowEmailRaw);
        const remaining = MAX_ATTEMPTS - ((row.attempts as number) + 1);
        return json({ ok: false, error: `Invalid code. ${remaining > 0 ? `${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` : "No attempts remaining."}` });
      }

      // Code is correct — set password and confirm email. Unconfirmed users cannot use
      // signInWithPassword (Supabase returns generic "Invalid login credentials"); SMS OTP
      // proves ownership the same way as signup verify.
      const { error: pwErr } = await admin.auth.admin.updateUserById(row.user_id as string, {
        password: newPassword,
        email_confirm: true,
      });

      if (pwErr) {
        console.error(pwErr);
        return json({ ok: false, error: "Failed to update password. Please try again." });
      }

      // Clean up (match row email exactly for delete).
      await admin.from("signup_phone_verification_challenges").delete().eq("email", rowEmailRaw);

      return json({ ok: true });
    }

    // ──────────────────────────────────────────────────────────
    // RESEND for phone-based reset (same challenge, new code)
    // ──────────────────────────────────────────────────────────

    if (action === "resend_password_reset_by_phone") {
      if (!infobipBase || !infobipKey) {
        return json({ ok: false, error: "SMS service is not configured on the server." });
      }

      const emailToken = normalizeEmail(String((body as Record<string, unknown>).email_token ?? ""));
      const channel    = (String((body as Record<string, unknown>).channel ?? "sms")) as "sms" | "whatsapp";

      if (!emailToken) {
        return json({ ok: false, error: "Session expired. Please start again." });
      }

      let { data: row, error: fetchErr } = await admin
        .from("signup_phone_verification_challenges")
        .select("*")
        .eq("email", emailToken)
        .maybeSingle();

      if (!fetchErr && !row) {
        const r2 = await admin
          .from("signup_phone_verification_challenges")
          .select("*")
          .ilike("email", emailToken)
          .maybeSingle();
        row = r2.data;
        fetchErr = r2.error;
      }

      if (fetchErr || !row) {
        return json({ ok: false, error: "Session expired. Please start again." });
      }

      const rowEmailRaw = String(row.email ?? "");
      const rowEmailKey = normalizeEmail(rowEmailRaw);

      const destination = row.destination_e164 as string;
      if (channel === "sms" && !smsFrom) return json({ ok: false, error: "SMS not configured." });
      if (channel === "whatsapp" && !waFrom) return json({ ok: false, error: "WhatsApp not configured." });

      const code     = randomDigits(CODE_LENGTH);
      const codeHash = await sha256Hex(`${pepper}:${rowEmailKey}:${code}`);
      const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

      await admin
        .from("signup_phone_verification_challenges")
        .update({ channel, code_hash: codeHash, attempts: 0, expires_at: expiresAt, updated_at: new Date().toISOString() })
        .eq("email", rowEmailRaw);

      const msgText = smsResetOtp(code);

      try {
        if (channel === "sms") {
          await sendInfobipSms(infobipBase, infobipKey, recoveryFrom, destination, msgText);
        } else {
          await sendInfobipWhatsappText(infobipBase, infobipKey, waFrom, destination, msgText);
        }
      } catch (e) {
        return json({ ok: false, error: e instanceof Error ? e.message : "Failed to resend." });
      }

      return json({ ok: true, channel_used: channel });
    }

    return json(
      {
        ok: false,
        error:
          "Unknown action. If password reset fails here, deploy the latest signup-verification Edge Function (verify_password_reset_otp).",
      },
      400,
    );
  } catch (e) {
    console.error(e);
    return json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected server error." },
      500,
    );
  }
});
