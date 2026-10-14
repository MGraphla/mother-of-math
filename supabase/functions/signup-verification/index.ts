// Supabase Edge Function: sign-up verification and password reset by SMS / email code.
//
// Secrets: INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_SMS_FROM,
//          INFOBIP_SMS_RECOVERY_FROM (optional), SIGNUP_OTP_PEPPER (recommended)
//
// Actions (all POST JSON `{ action, ... }`, always HTTP 200 with `{ ok, error? }`):
//   check_signup_availability   email + phone are free (clears abandoned unverified sign-ups)
//   start | resend | verify      SMS sign-up code
//   start_password_reset_by_email | resend_password_reset_by_email
//   start_password_reset_by_phone | resend_password_reset_by_phone
//   verify_password_reset_otp | verify_and_set_password
//
// Requires migration 20261014120000_auth_hardening.sql for fast email lookup and
// rate limiting; both degrade gracefully (slower lookup / no limit) without it.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const CODE_LENGTH = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Json = Record<string, unknown>;
type Purpose = "signup" | "password_reset";

/** Always HTTP 200 so supabase-js exposes the body; success is `ok`. */
function json(body: Json) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const fail = (error: string, extra: Json = {}) => json({ ok: false, error, ...extra });

// ── Small utilities ─────────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomDigits(n: number): string {
  // Rejection sampling avoids modulo bias.
  let s = "";
  const buf = new Uint8Array(1);
  while (s.length < n) {
    crypto.getRandomValues(buf);
    if (buf[0] < 250) s += String(buf[0] % 10);
  }
  return s;
}

const normalizeEmail = (email: unknown) => String(email ?? "").trim().toLowerCase();
const digitsOnly = (v: unknown) => String(v ?? "").replace(/\D/g, "");

function dialCountry(raw: string): "Cameroon" | "Nigeria" | "Other" {
  const t = String(raw ?? "").trim().toLowerCase();
  if (t.includes("nigeria") || t === "ng") return "Nigeria";
  if (t.includes("cameroon") || t === "cm") return "Cameroon";
  return "Other";
}

function normalizeE164(phone: string, country: string): string {
  const cc = dialCountry(country);
  const digits = String(phone ?? "").replace(/[\s\-().]/g, "");
  if (cc === "Cameroon") {
    if (digits.startsWith("+237")) return digits;
    if (digits.startsWith("00237")) return `+${digits.slice(2)}`;
    if (digits.startsWith("237") && digits.length === 12) return `+${digits}`;
    return `+237${digits.replace(/^0/, "")}`;
  }
  if (cc === "Nigeria") {
    if (digits.startsWith("+234")) return digits;
    if (digits.startsWith("00234")) return `+${digits.slice(2)}`;
    if (digits.startsWith("234") && digits.length === 13) return `+${digits}`;
    if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
    return `+234${digits}`;
  }
  if (digits.startsWith("+")) return digits;
  return `+${digits.replace(/^0+/, "")}`;
}

const isPlausibleE164 = (n: string) => /^\+[1-9]\d{6,14}$/.test(n);

function maskE164(e164: string): string {
  const d = e164.replace(/\D/g, "");
  const cc = d.slice(0, Math.min(3, Math.max(1, d.length - 6)));
  return `+${cc} ••• ${d.slice(-4)}`;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || req.headers.get("cf-connecting-ip") || "unknown").trim();
}

// ── Messaging ───────────────────────────────────────────────────────────────

const smsSignupText = (code: string) => `Mama Math code: ${code}. Expires in 10 min.`;
const smsResetText = (code: string) => `Mama Math reset code: ${code}. Expires in 10 min. Never share it.`;

function normalizeInfobipBaseUrl(raw: string): string {
  const t = raw.trim().replace(/\/$/, "");
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

async function sendSms(cfg: Config, from: string, to: string, text: string): Promise<void> {
  const res = await fetch(`${cfg.infobipBase}/sms/2/text/advanced`, {
    method: "POST",
    headers: {
      Authorization: `App ${cfg.infobipKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ messages: [{ from, destinations: [{ to }], text }] }),
  });
  if (!res.ok) {
    console.error("SMS send failed", res.status, (await res.text()).slice(0, 400));
    throw new Error("We couldn't send the text message. Check the number and try again.");
  }
}

/** GoTrue sends the "Reset password" template, which shows {{ .Token }}. */
async function sendRecoveryEmail(cfg: Config, email: string): Promise<boolean> {
  const res = await fetch(`${cfg.supabaseUrl}/auth/v1/recover`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.serviceKey}`,
      apikey: cfg.serviceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  if (res.ok) return true;
  console.error("GoTrue recover failed", res.status, (await res.text()).slice(0, 300));
  return false;
}

// ── Data access ─────────────────────────────────────────────────────────────

type Config = {
  supabaseUrl: string;
  serviceKey: string;
  infobipBase: string;
  infobipKey: string;
  smsFrom: string;
  recoveryFrom: string;
  pepper: string;
};

type AuthUserLite = { id: string; emailConfirmed: boolean };

async function findUserByEmail(admin: SupabaseClient, cfg: Config, email: string): Promise<AuthUserLite | null> {
  const { data, error } = await admin.rpc("auth_user_by_email", { p_email: email });
  if (!error) {
    const row = Array.isArray(data) ? data[0] : null;
    return row ? { id: row.id as string, emailConfirmed: !!row.email_confirmed } : null;
  }

  // Fallback for projects without the migration: page through users.
  console.warn("auth_user_by_email RPC unavailable, paging users:", error.message);
  for (let page = 1; page <= 200; page++) {
    const res = await fetch(`${cfg.supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=100`, {
      headers: { Authorization: `Bearer ${cfg.serviceKey}`, apikey: cfg.serviceKey },
    });
    if (!res.ok) return null;
    const users: Array<{ id: string; email?: string; email_confirmed_at?: string }> =
      (await res.json()).users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (match) return { id: match.id, emailConfirmed: !!match.email_confirmed_at };
    if (users.length < 100) return null;
  }
  return null;
}

/** True when allowed. Fails open if the rate-limit table is missing. */
async function allow(admin: SupabaseClient, bucket: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await admin.rpc("auth_rate_limit_hit", {
    p_bucket: bucket,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.warn("rate limit unavailable:", error.message);
    return true;
  }
  return data !== false;
}

const TOO_MANY = "Too many requests. Please wait a few minutes and try again.";

/** One send every 45s per number, at most 5 per hour; at most 20 SMS per hour per IP. */
async function allowSms(admin: SupabaseClient, ip: string, destination: string): Promise<string | null> {
  if (!(await allow(admin, `sms-burst:${destination}`, 1, 45))) {
    return "Please wait a moment before requesting another code.";
  }
  if (!(await allow(admin, `sms-hour:${destination}`, 5, 3600))) return TOO_MANY;
  if (!(await allow(admin, `sms-ip:${ip}`, 20, 3600))) return TOO_MANY;
  return null;
}

type Challenge = {
  id: string;
  user_id: string;
  email: string;
  destination_e164: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  purpose?: string | null;
};

async function getChallengeByEmail(admin: SupabaseClient, email: string): Promise<Challenge | null> {
  const { data } = await admin
    .from("signup_phone_verification_challenges")
    .select("*")
    .ilike("email", email)
    .maybeSingle();
  return (data as Challenge | null) ?? null;
}

async function getChallengeById(admin: SupabaseClient, id: string): Promise<Challenge | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin
    .from("signup_phone_verification_challenges")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Challenge | null) ?? null;
}

/** Password-reset challenges are addressed by opaque `reset_id`; `email_token` kept for old app builds. */
async function getResetChallenge(admin: SupabaseClient, b: Json): Promise<Challenge | null> {
  const resetId = String(b.reset_id ?? "").trim();
  const row = resetId
    ? await getChallengeById(admin, resetId)
    : await getChallengeByEmail(admin, normalizeEmail(b.email_token));
  if (!row || (row.purpose ?? "signup") !== "password_reset") return null;
  return row;
}

const purposeOf = (row: Challenge): Purpose => (row.purpose === "password_reset" ? "password_reset" : "signup");

async function hashCode(cfg: Config, email: string, code: string) {
  return sha256Hex(`${cfg.pepper}:${normalizeEmail(email)}:${code}`);
}

async function storeChallenge(
  admin: SupabaseClient,
  cfg: Config,
  input: { userId: string; email: string; destination: string; purpose: Purpose },
): Promise<{ id: string; code: string } | null> {
  const code = randomDigits(CODE_LENGTH);
  await admin.from("signup_phone_verification_challenges").delete().eq("user_id", input.userId);
  await admin.from("signup_phone_verification_challenges").delete().ilike("email", input.email);

  const row = {
    user_id: input.userId,
    email: input.email,
    channel: "sms",
    destination_e164: input.destination,
    code_hash: await hashCode(cfg, input.email, code),
    attempts: 0,
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    updated_at: new Date().toISOString(),
    purpose: input.purpose,
  };
  const { data, error } = await admin
    .from("signup_phone_verification_challenges")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    console.error("store challenge failed", error);
    return null;
  }
  return { id: data.id as string, code };
}

async function rotateChallengeCode(admin: SupabaseClient, cfg: Config, row: Challenge): Promise<string> {
  const code = randomDigits(CODE_LENGTH);
  await admin
    .from("signup_phone_verification_challenges")
    .update({
      code_hash: await hashCode(cfg, row.email, code),
      attempts: 0,
      expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  return code;
}

/** Checks a code against a challenge; increments attempts on failure. Returns an error message or null. */
async function checkCode(admin: SupabaseClient, cfg: Config, row: Challenge, code: string): Promise<string | null> {
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return "This code has expired. Request a new one.";
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return "Too many incorrect attempts. Request a new code.";
  }
  const expected = await hashCode(cfg, row.email, code);
  if (safeEqual(expected, row.code_hash)) return null;

  const attempts = row.attempts + 1;
  await admin
    .from("signup_phone_verification_challenges")
    .update({ attempts, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  const remaining = MAX_ATTEMPTS - attempts;
  return remaining > 0
    ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
    : "Too many incorrect attempts. Request a new code.";
}

/** Returns an error if a phone is already used by another account or pending sign-up. */
async function phoneTaken(
  admin: SupabaseClient,
  targets: string[],
  currentEmail: string,
  excludeUserId: string | null,
): Promise<string | null> {
  for (const target of new Set(targets)) {
    if (!isPlausibleE164(target)) continue;

    const { data: pending } = await admin
      .from("signup_phone_verification_challenges")
      .select("email, purpose, expires_at")
      .eq("destination_e164", target)
      .neq("email", currentEmail)
      .limit(5);
    const activeSignup = (pending ?? []).some(
      (p) => (p.purpose ?? "signup") === "signup" && new Date(p.expires_at as string).getTime() > Date.now(),
    );
    if (activeSignup) return "This phone number is already being used to create another account.";

    const tail = target.replace(/\D/g, "").slice(-8);
    if (tail.length < 8) continue;
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, phone_number, whatsapp_number, country")
      .or(`phone_number.ilike.%${tail},whatsapp_number.ilike.%${tail}`)
      .limit(20);
    for (const p of profiles ?? []) {
      if (excludeUserId && p.id === excludeUserId) continue;
      const c = (p.country as string) || "Cameroon";
      const nums = [p.phone_number, p.whatsapp_number].filter(Boolean).map((n) => normalizeE164(String(n), c));
      if (nums.includes(target)) {
        return "This phone number is already registered. Sign in, or use a different number.";
      }
    }
  }
  return null;
}

type ProfilePayload = Record<string, unknown>;

const PROFILE_KEYS = [
  "full_name", "gender", "country", "city", "school_name", "school_address", "school_type",
  "number_of_students", "number_of_classes", "subjects_taught", "grade_levels",
  "years_of_experience", "education_level", "phone_number", "whatsapp_number", "bio",
  "date_of_birth", "preferred_language",
] as const;

function sanitizeProfile(raw: unknown): ProfilePayload {
  const p = (raw && typeof raw === "object" ? raw : {}) as ProfilePayload;
  const out: ProfilePayload = { role: p.role === "parent" ? "parent" : "teacher" };
  for (const k of PROFILE_KEYS) {
    const v = p[k];
    if (v === undefined || v === null || v === "") continue;
    out[k] = typeof v === "string" ? v.slice(0, 500) : v;
  }
  return out;
}

// ── Handlers ────────────────────────────────────────────────────────────────

type Ctx = { admin: SupabaseClient; cfg: Config; b: Json; ip: string };

async function checkSignupAvailability({ admin, cfg, b, ip }: Ctx) {
  const email = normalizeEmail(b.email);
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");
  if (!(await allow(admin, `check-ip:${ip}`, 40, 3600))) return fail(TOO_MANY);

  const existing = await findUserByEmail(admin, cfg, email);
  if (existing?.emailConfirmed) {
    return fail("This email is already registered. Sign in instead.", { already_registered: true });
  }
  if (existing) {
    // An earlier sign-up was never verified — clear it so this attempt starts fresh.
    const { error } = await admin.auth.admin.deleteUser(existing.id);
    if (error) console.warn("could not clear unverified user", error.message);
  }

  const country = String(b.country ?? "Cameroon");
  const targets = [b.phone_number, b.whatsapp_number]
    .filter((v) => String(v ?? "").trim())
    .map((v) => normalizeE164(String(v), country));
  const phoneErr = await phoneTaken(admin, targets, email, null);
  if (phoneErr) return fail(phoneErr);

  return json({ ok: true });
}

async function startSignup({ admin, cfg, b, ip }: Ctx) {
  if (!cfg.infobipBase || !cfg.infobipKey || !cfg.smsFrom) {
    return fail("Text messages are not available right now. Choose email instead.");
  }
  const email = normalizeEmail(b.email);
  const password = String(b.password ?? "");
  const country = String(b.country ?? "Cameroon");
  const destination = normalizeE164(String(b.destination ?? ""), country);
  const profile = sanitizeProfile(b.profile);

  if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");
  if (password.length < 8) return fail("Password must be at least 8 characters.");
  if (!isPlausibleE164(destination)) return fail("Enter a valid phone number.");

  const existing = await findUserByEmail(admin, cfg, email);
  if (existing?.emailConfirmed) {
    return fail("This email is already registered. Sign in instead.", { already_registered: true });
  }

  const phoneErr = await phoneTaken(
    admin,
    [destination, ...[profile.phone_number, profile.whatsapp_number].filter(Boolean).map((n) => normalizeE164(String(n), country))],
    email,
    existing?.id ?? null,
  );
  if (phoneErr) return fail(phoneErr);

  const limited = await allowSms(admin, ip, destination);
  if (limited) return fail(limited);

  let userId: string;
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: profile,
    });
    if (error) return fail("Could not start sign-up. Please try again.");
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: profile,
    });
    if (error || !data.user?.id) {
      const msg = (error?.message ?? "").toLowerCase();
      if (/already|registered|exists/.test(msg)) return fail("This email is already registered. Sign in instead.");
      return fail("Could not create the account. Please try again.");
    }
    userId = data.user.id;
  }

  const ch = await storeChallenge(admin, cfg, { userId, email, destination, purpose: "signup" });
  if (!ch) return fail("Could not start verification. Please try again.");

  try {
    await sendSms(cfg, cfg.smsFrom, destination, smsSignupText(ch.code));
  } catch (e) {
    await admin.from("signup_phone_verification_challenges").delete().eq("id", ch.id);
    return fail((e as Error).message);
  }
  return json({ ok: true, masked_phone: maskE164(destination) });
}

async function resendSignup({ admin, cfg, b, ip }: Ctx) {
  if (!cfg.infobipBase || !cfg.infobipKey || !cfg.smsFrom) {
    return fail("Text messages are not available right now.");
  }
  const email = normalizeEmail(b.email);
  const row = await getChallengeByEmail(admin, email);
  if (!row || purposeOf(row) !== "signup") return fail("No sign-up is waiting for this email. Start again.");

  const user = await findUserByEmail(admin, cfg, email);
  if (!user || user.emailConfirmed) {
    await admin.from("signup_phone_verification_challenges").delete().eq("id", row.id);
    return fail("This account is already verified. Sign in instead.");
  }

  const limited = await allowSms(admin, ip, row.destination_e164);
  if (limited) return fail(limited);

  const code = await rotateChallengeCode(admin, cfg, row);
  try {
    await sendSms(cfg, cfg.smsFrom, row.destination_e164, smsSignupText(code));
  } catch (e) {
    return fail((e as Error).message);
  }
  return json({ ok: true, masked_phone: maskE164(row.destination_e164) });
}

async function verifySignup({ admin, cfg, b }: Ctx) {
  const email = normalizeEmail(b.email);
  const code = digitsOnly(b.code);
  if (!email || code.length !== CODE_LENGTH) return fail("Enter the 6-digit code.");

  const row = await getChallengeByEmail(admin, email);
  if (!row || purposeOf(row) !== "signup") return fail("No sign-up is waiting for this email. Start again.");

  const err = await checkCode(admin, cfg, row, code);
  if (err) return fail(err);

  // Confirming the email fires the DB trigger that creates the profile row.
  const { error } = await admin.auth.admin.updateUserById(row.user_id, { email_confirm: true });
  if (error) {
    console.error("confirm failed", error);
    return fail("Could not verify the account. Please try again.");
  }
  await admin.from("signup_phone_verification_challenges").delete().eq("id", row.id);
  return json({ ok: true });
}

async function startResetByEmail({ admin, cfg, b, ip }: Ctx) {
  const email = normalizeEmail(b.email ?? b.email_token);
  if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");
  if (!(await allow(admin, `reset-email-ip:${ip}`, 20, 3600))) return fail(TOO_MANY);
  if (!(await allow(admin, `reset-email:${email}`, 5, 3600))) return fail(TOO_MANY);

  const user = await findUserByEmail(admin, cfg, email);
  if (!user) {
    return fail("No account uses this email.", { not_registered: true });
  }
  if (!(await sendRecoveryEmail(cfg, email))) {
    return fail("We couldn't send the email. Wait a minute and try again.");
  }
  return json({ ok: true, email_token: email, delivery: "recovery" });
}

async function startResetByPhone({ admin, cfg, b, ip }: Ctx) {
  if (!cfg.infobipBase || !cfg.infobipKey || !(cfg.recoveryFrom || cfg.smsFrom)) {
    return fail("Text messages are not available right now. Use email instead.");
  }
  if (!(await allow(admin, `reset-phone-ip:${ip}`, 15, 3600))) return fail(TOO_MANY);

  const country = String(b.country ?? "Cameroon");
  const target = normalizeE164(String(b.phone ?? ""), country);
  if (!isPlausibleE164(target)) return fail("Enter a valid phone number.");

  const tail = target.replace(/\D/g, "").slice(-8);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, phone_number, whatsapp_number, country")
    .or(`phone_number.ilike.%${tail},whatsapp_number.ilike.%${tail}`)
    .limit(20);

  const match = (profiles ?? []).find((p) => {
    const c = (p.country as string) || country;
    return [p.phone_number, p.whatsapp_number]
      .filter(Boolean)
      .some((n) => normalizeE164(String(n), c) === target);
  });
  if (!match) return fail("No account uses this phone number.", { not_registered: true });

  const limited = await allowSms(admin, ip, target);
  if (limited) return fail(limited);

  const ch = await storeChallenge(admin, cfg, {
    userId: match.id as string,
    email: normalizeEmail(match.email),
    destination: target,
    purpose: "password_reset",
  });
  if (!ch) return fail("Could not start the reset. Please try again.");

  try {
    await sendSms(cfg, cfg.recoveryFrom || cfg.smsFrom, target, smsResetText(ch.code));
  } catch (e) {
    await admin.from("signup_phone_verification_challenges").delete().eq("id", ch.id);
    return fail((e as Error).message);
  }
  // Never return the account email — only an opaque id for the next steps.
  return json({ ok: true, reset_id: ch.id, masked_phone: maskE164(target) });
}

async function resendResetByPhone({ admin, cfg, b, ip }: Ctx) {
  if (!cfg.infobipBase || !cfg.infobipKey || !(cfg.recoveryFrom || cfg.smsFrom)) {
    return fail("Text messages are not available right now.");
  }
  const row = await getResetChallenge(admin, b);
  if (!row) return fail("This reset has expired. Start again.");

  const limited = await allowSms(admin, ip, row.destination_e164);
  if (limited) return fail(limited);

  const code = await rotateChallengeCode(admin, cfg, row);
  try {
    await sendSms(cfg, cfg.recoveryFrom || cfg.smsFrom, row.destination_e164, smsResetText(code));
  } catch (e) {
    return fail((e as Error).message);
  }
  return json({ ok: true, masked_phone: maskE164(row.destination_e164) });
}

async function verifyResetCode({ admin, cfg, b }: Ctx) {
  const code = digitsOnly(b.code);
  if (code.length !== CODE_LENGTH) return fail("Enter the 6-digit code.");
  const row = await getResetChallenge(admin, b);
  if (!row) return fail("This reset has expired. Start again.");
  const err = await checkCode(admin, cfg, row, code);
  return err ? fail(err) : json({ ok: true });
}

async function verifyAndSetPassword({ admin, cfg, b }: Ctx) {
  const code = digitsOnly(b.code);
  const newPassword = String(b.new_password ?? "");
  if (code.length !== CODE_LENGTH) return fail("Enter the 6-digit code.");
  if (newPassword.length < 8) return fail("Password must be at least 8 characters.");

  const row = await getResetChallenge(admin, b);
  if (!row) return fail("This reset has expired. Start again.");
  const err = await checkCode(admin, cfg, row, code);
  if (err) return fail(err);

  // Owning the phone proves identity, so an unverified email is confirmed too
  // (otherwise the user still couldn't sign in).
  const { error } = await admin.auth.admin.updateUserById(row.user_id, {
    password: newPassword,
    email_confirm: true,
  });
  if (error) {
    console.error("password update failed", error);
    const weak = /password/i.test(error.message ?? "");
    return fail(weak ? error.message : "Could not update the password. Please try again.");
  }
  await admin.from("signup_phone_verification_challenges").delete().eq("id", row.id);
  return json({ ok: true, email: row.email });
}

const HANDLERS: Record<string, (ctx: Ctx) => Promise<Response>> = {
  check_signup_availability: checkSignupAvailability,
  start: startSignup,
  resend: resendSignup,
  verify: verifySignup,
  start_password_reset_by_email: startResetByEmail,
  resend_password_reset_by_email: startResetByEmail,
  start_password_reset_by_phone: startResetByPhone,
  resend_password_reset_by_phone: resendResetByPhone,
  verify_password_reset_otp: verifyResetCode,
  verify_and_set_password: verifyAndSetPassword,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed.");

  try {
    const cfg: Config = {
      supabaseUrl: (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, ""),
      serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      infobipBase: normalizeInfobipBaseUrl(Deno.env.get("INFOBIP_BASE_URL") ?? ""),
      infobipKey: (Deno.env.get("INFOBIP_API_KEY") ?? "").trim().replace(/^App\s+/i, ""),
      smsFrom: Deno.env.get("INFOBIP_SMS_FROM") ?? "",
      recoveryFrom: Deno.env.get("INFOBIP_SMS_RECOVERY_FROM") ?? "",
      pepper: Deno.env.get("SIGNUP_OTP_PEPPER") ?? "",
    };
    if (!cfg.supabaseUrl || !cfg.serviceKey) return fail("Server is not configured.");

    let body: unknown = null;
    try {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }
    if (!body || typeof body !== "object") return fail("Invalid request.");

    // Some proxies double-wrap: { body: { action, ... } }
    const top = body as Json;
    const b = (!("action" in top) && top.body && typeof top.body === "object" ? top.body : top) as Json;
    const action = String(b.action ?? "").trim().toLowerCase();

    const handler = HANDLERS[action];
    if (!handler) return fail("Unknown action.");

    const admin = createClient(cfg.supabaseUrl, cfg.serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    return await handler({ admin, cfg, b, ip: clientIp(req) });
  } catch (e) {
    console.error(e);
    return fail("Something went wrong. Please try again.");
  }
});
