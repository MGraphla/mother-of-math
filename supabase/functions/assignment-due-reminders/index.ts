// Supabase Edge Function: Assignment due reminders (scheduled SMS / in-app).
// Run on a cron (hourly recommended) so 48h / 24h / day-of windows stay accurate.
//
// Per-assignment flags (assignments table): reminder_48h, reminder_24h, reminder_due_day,
// reminder_parent_sms. Only assignments with at least one reminder_* true are processed.
// Deduped via assignment_reminder_log (assignment_id, student_id, reminder_key).
//
// Secrets: INFOBIP_BASE_URL, INFOBIP_API_KEY, INFOBIP_SMS_FROM
// DB columns from migration 20250327130000_assignment_teacher_features.sql

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

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

async function sendSms(
  baseUrl: string,
  apiKey: string,
  from: string,
  toE164: string,
  text: string,
): Promise<boolean> {
  try {
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
      console.error(`SMS to ${toE164} failed (${res.status}): ${errTxt.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`SMS to ${toE164} exception:`, e);
    return false;
  }
}

type AssignmentRow = {
  id: string;
  title: string;
  due_date: string;
  reminder_48h?: boolean;
  reminder_24h?: boolean;
  reminder_due_day?: boolean;
  reminder_parent_sms?: boolean;
};

function reminderKeysForHours(
  a: AssignmentRow,
  hoursToDue: number,
): string[] {
  const keys: string[] = [];
  const r48 = a.reminder_48h === true;
  const r24 = a.reminder_24h === true;
  const rd = a.reminder_due_day === true;

  if (r48 && hoursToDue <= 48 && hoursToDue > 24) keys.push("48h");
  if (r24 && hoursToDue <= 24 && hoursToDue > 6) keys.push("24h");
  if (rd && hoursToDue <= 12 && hoursToDue >= -8) keys.push("due_day");

  return keys;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const infobipBase = normalizeInfobipBaseUrl(Deno.env.get("INFOBIP_BASE_URL") ?? "");
  const infobipKey = normalizeInfobipApiKey(Deno.env.get("INFOBIP_API_KEY") ?? "");
  const smsFrom = Deno.env.get("INFOBIP_SMS_FROM") ?? "";

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = Date.now();
  const nowDate = new Date(now);
  const windowStart = new Date(now - 8 * 3600 * 1000).toISOString();
  const windowEnd = new Date(now + 72 * 3600 * 1000).toISOString();

  const { data: assignments, error: aErr } = await admin
    .from("assignments")
    .select(
      "id, title, due_date, reminder_48h, reminder_24h, reminder_due_day, reminder_parent_sms",
    )
    .eq("status", "active")
    .gte("due_date", windowStart)
    .lte("due_date", windowEnd);

  if (aErr) {
    console.error("Error fetching assignments:", aErr);
    return json({ ok: false, error: aErr.message });
  }

  const list = (assignments || []) as AssignmentRow[];
  const enabled = list.filter(
    (a) => a.reminder_48h || a.reminder_24h || a.reminder_due_day,
  );

  if (enabled.length === 0) {
    return json({
      ok: true,
      sent: 0,
      in_app: 0,
      message: "No assignments with reminder toggles in this due window.",
    });
  }

  let totalSms = 0;
  let totalInApp = 0;
  const errors: string[] = [];

  const smsReady = !!(infobipBase && infobipKey && smsFrom);

  for (const assignment of enabled) {
    const dueMs = new Date(assignment.due_date).getTime();
    const hoursToDue = (dueMs - now) / 3600000;
    const keys = reminderKeysForHours(assignment, hoursToDue);
    if (keys.length === 0) continue;

    const { data: links } = await admin
      .from("assignment_students")
      .select("student_id")
      .eq("assignment_id", assignment.id);

    if (!links || links.length === 0) continue;

    const studentIds = links.map((l: { student_id: string }) => l.student_id);

    const { data: subs } = await admin
      .from("assignment_submissions")
      .select("student_id")
      .eq("assignment_id", assignment.id);

    const submittedIds = new Set((subs || []).map((s: { student_id: string }) => s.student_id));
    const pendingIds = studentIds.filter((id: string) => !submittedIds.has(id));
    if (pendingIds.length === 0) continue;

    const { data: students } = await admin
      .from("students")
      .select("id, full_name, parent_phone, nationality")
      .in("id", pendingIds)
      .eq("account_status", "active");

    if (!students) continue;

    const dueFormatted = new Date(assignment.due_date).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const dueSms = new Date(assignment.due_date).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    for (const student of students) {
      for (const key of keys) {
        const { data: existing } = await admin
          .from("assignment_reminder_log")
          .select("id")
          .eq("assignment_id", assignment.id)
          .eq("student_id", student.id)
          .eq("reminder_key", key)
          .maybeSingle();

        if (existing) continue;

        const title =
          key === "48h"
            ? `Reminder: "${assignment.title}" due in 2 days`
            : key === "24h"
            ? `Reminder: "${assignment.title}" due soon`
            : `Due now: "${assignment.title}"`;

        const message =
          `Please submit "${assignment.title}" before ${dueFormatted}.`;

        const wantParentSms = assignment.reminder_parent_sms === true;
        let delivered = false;

        if (wantParentSms && smsReady && student.parent_phone) {
          const country = student.nationality || "Cameroon";
          const dest = normalizeE164(student.parent_phone, country);
          if (!isPlausibleE164(dest)) {
            errors.push(`Bad phone: ${student.full_name}`);
          } else {
            const titleShort =
              assignment.title.length > 28
                ? `${assignment.title.slice(0, 25)}...`
                : assignment.title;
            const nameShort =
              student.full_name.length > 18
                ? `${student.full_name.slice(0, 15)}...`
                : student.full_name;
            const smsText =
              `MM ${nameShort}: "${titleShort}" by ${dueSms}. Portal.`;
            const ok = await sendSms(infobipBase, infobipKey, smsFrom, dest, smsText);
            if (ok) {
              delivered = true;
              totalSms++;
            } else errors.push(`SMS failed: ${student.full_name}`);
          }
        }

        if (!delivered) {
          const { error: insN } = await admin.from("notifications").insert({
            recipient_student_id: student.id,
            type: "assignment_due",
            title,
            message,
            link_url: "/student/assignments",
            related_assignment_id: assignment.id,
          });
          if (insN) {
            console.error("notification insert failed", insN);
            errors.push(`Notify failed: ${student.full_name}`);
            continue;
          }
          totalInApp++;
        }

        await admin.from("assignment_reminder_log").insert({
          assignment_id: assignment.id,
          student_id: student.id,
          reminder_key: key,
        });
      }
    }
  }

  console.log(
    `Reminders: sms=${totalSms} in_app=${totalInApp} errors=${errors.length}`,
  );
  return json({
    ok: true,
    sms_sent: totalSms,
    in_app_sent: totalInApp,
    assignments_checked: enabled.length,
    errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    sms_configured: smsReady,
    note: nowDate.toISOString(),
  });
});
