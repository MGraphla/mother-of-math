import { supabase } from "@/lib/supabase";
import { resolveSmsDialCountry } from "@/lib/phone";

/** Keeps transactional SMS in one segment when possible (GSM-7 ~160 chars). */
function smsClip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}...`;
}

function firstName(fullName: string, max: number): string {
  const w = fullName.trim().split(/\s+/)[0] || fullName.trim() || "Student";
  return smsClip(w, max);
}

export interface SmsResult {
  success: boolean;
  error?: string;
}

async function invokeSmsFunction(
  to: string,
  message: string,
  country: string,
): Promise<SmsResult> {
  const dial = resolveSmsDialCountry(country);
  try {
    const { data, error } = await supabase.functions.invoke("send-sms-notification", {
      body: { to, message, country: dial },
    });

    const bodyError =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: string }).error)
        : "";

    if (error) {
      return { success: false, error: bodyError || error.message };
    }

    if (data && typeof data === "object" && "ok" in data && !(data as { ok: boolean }).ok) {
      return { success: false, error: bodyError || "SMS send failed." };
    }

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Unexpected error sending SMS.",
    };
  }
}

/** Fire-and-forget: logs failures but never throws */
export function smsSilent(
  to: string,
  message: string,
  country: string,
): void {
  invokeSmsFunction(to, message, country).catch((e) =>
    console.warn("[SMS silent] failed:", e),
  );
}

export async function sendStudentCodeSms(
  parentPhone: string,
  studentName: string,
  studentCode: string | null,
  accessLink: string,
  schoolName: string | null,
  country: string,
): Promise<SmsResult> {
  const code = studentCode || "—";
  const nm = firstName(studentName, 14);
  const msg = `MM ${nm} code ${code} ${accessLink}`;
  return invokeSmsFunction(parentPhone, msg, country);
}

/** Short guardian onboarding text + link (pair with printable PDF from teacher). */
export async function sendGuardianPacketSms(
  parentPhone: string,
  studentName: string,
  studentCode: string | null,
  accessLink: string,
  schoolName: string | null,
  country: string,
): Promise<SmsResult> {
  const code = studentCode || "?";
  const nm = firstName(studentName, 14);
  const msg = `MM ${nm} ${code} ${accessLink}`;
  return invokeSmsFunction(parentPhone, msg, country);
}

export async function sendAssignmentNotificationSms(
  parentPhone: string,
  _parentName: string | null,
  studentName: string,
  assignmentTitle: string,
  dueDate: string | null,
  country: string,
): Promise<SmsResult> {
  const title = smsClip(assignmentTitle, 36);
  const st = firstName(studentName, 14);
  const due = dueDate ? ` ${smsClip(dueDate, 22)}` : "";
  const msg = `MM ${st}: new "${title}"${due}. Portal.`;
  return invokeSmsFunction(parentPhone, msg, country);
}

export function sendGradedSms(
  parentPhone: string,
  studentName: string,
  assignmentTitle: string,
  score: string,
  country: string,
): void {
  const title = smsClip(assignmentTitle, 32);
  const st = firstName(studentName, 12);
  const msg = `MM ${st} graded "${title}" ${smsClip(score, 12)}. Portal.`;
  smsSilent(parentPhone, msg, country);
}

/**
 * AI work summary for parents — short line + optional portal link.
 * @param plainLanguageHint clipped for one SMS segment
 */
export function sendParentStudentWorkAiSummarySms(
  parentPhone: string,
  studentFullName: string,
  country: string,
  studentPortalLoginUrl?: string,
  plainLanguageHint?: string,
): void {
  const first = firstName(studentFullName, 12);
  let hint = plainLanguageHint?.replace(/\s+/g, " ").trim();
  if (hint && hint.length > 55) {
    hint = `${hint.slice(0, 52).trim()}...`;
  }
  const base = hint ? `MM ${first}: ${hint}` : `MM ${first}: new feedback. Portal.`;
  const url = studentPortalLoginUrl?.trim();
  const msg = url ? `${base} ${url}` : base;
  smsSilent(parentPhone, msg, country);
}

export function sendResubmitSms(
  parentPhone: string,
  studentName: string,
  assignmentTitle: string,
  country: string,
): void {
  const title = smsClip(assignmentTitle, 34);
  const st = firstName(studentName, 12);
  const msg = `MM ${st}: resubmit "${title}". Portal.`;
  smsSilent(parentPhone, msg, country);
}

export function sendAccessLinkSms(
  parentPhone: string,
  studentName: string,
  accessLink: string,
  country: string,
): void {
  const msg = `MM ${firstName(studentName, 12)}: ${accessLink}`;
  smsSilent(parentPhone, msg, country);
}

export async function sendDueReminderSms(
  parentPhone: string,
  studentName: string,
  assignmentTitle: string,
  dueDate: string,
  country: string,
): Promise<SmsResult> {
  const title = smsClip(assignmentTitle, 32);
  const st = firstName(studentName, 12);
  const due = smsClip(dueDate, 24);
  const msg = `MM ${st}: "${title}" due ${due}. Portal.`;
  return invokeSmsFunction(parentPhone, msg, country);
}

/** Teacher-triggered nudge for missing work (non-submitters). */
export function sendAssignmentNudgeSms(
  parentPhone: string,
  studentName: string,
  assignmentTitle: string,
  dueHint: string,
  country: string,
): void {
  const title = smsClip(assignmentTitle, 30);
  const st = firstName(studentName, 12);
  const hint = smsClip(dueHint, 28);
  const msg = `MM ${st}: missing "${title}". ${hint}`;
  smsSilent(parentPhone, msg, country);
}
