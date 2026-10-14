import { supabase } from "../lib/supabase";
import { invokeSignupVerification, SignupVerificationError } from "./signupVerification";

export { SignupVerificationError };

/**
 * Password reset by 6-digit code (same flow as the website):
 *  - email: Supabase sends the "Reset password" email with {{ .Token }};
 *           verifying it signs the user in with a recovery session.
 *  - sms:   the signup-verification Edge Function sends and checks the code
 *           (addressed by an opaque reset id — the account email is never exposed).
 */
export type ResetTicket =
  | { channel: "email"; email: string }
  | { channel: "sms"; resetId: string; maskedPhone: string };

export async function startPasswordResetByEmail(email: string): Promise<ResetTicket> {
  const clean = email.trim().toLowerCase();
  await invokeSignupVerification({ action: "start_password_reset_by_email", email: clean });
  return { channel: "email", email: clean };
}

export async function startPasswordResetByPhone(phone: string, country: string): Promise<ResetTicket> {
  const data = await invokeSignupVerification({
    action: "start_password_reset_by_phone",
    phone: phone.trim(),
    country,
  });
  return {
    channel: "sms",
    resetId: String(data.reset_id ?? ""),
    maskedPhone: String(data.masked_phone ?? ""),
  };
}

export async function resendPasswordReset(ticket: ResetTicket): Promise<void> {
  if (ticket.channel === "email") {
    await invokeSignupVerification({ action: "resend_password_reset_by_email", email: ticket.email });
    return;
  }
  await invokeSignupVerification({ action: "resend_password_reset_by_phone", reset_id: ticket.resetId });
}

export async function verifyPasswordResetCode(ticket: ResetTicket, code: string): Promise<void> {
  const token = code.replace(/\D/g, "");
  if (ticket.channel === "sms") {
    await invokeSignupVerification({ action: "verify_password_reset_otp", reset_id: ticket.resetId, code: token });
    return;
  }
  const { error } = await supabase.auth.verifyOtp({ email: ticket.email, token, type: "recovery" });
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? "That code is wrong or has expired." : error.message);
}

/** Saves the new password and leaves the user signed in. Returns the account email. */
export async function setPasswordAfterReset(ticket: ResetTicket, code: string, newPassword: string): Promise<string> {
  if (ticket.channel === "email") {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message || "Failed to update password.");
    return ticket.email;
  }
  const data = await invokeSignupVerification({
    action: "verify_and_set_password",
    reset_id: ticket.resetId,
    code: code.replace(/\D/g, ""),
    new_password: newPassword,
  });
  return String(data.email ?? "");
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(1, name.length - visible.length))}@${domain}`;
}
