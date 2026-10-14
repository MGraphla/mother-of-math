import { supabase } from "../lib/supabase";
import {
  invokeSignupVerification,
  SignupVerificationError,
} from "./signupVerification";

export type PasswordResetDelivery = "challenge" | "recovery";

export { SignupVerificationError };

function parseDelivery(raw: unknown): PasswordResetDelivery {
  return raw === "recovery" || raw === "gotrue" || raw === "email_otp" ? "recovery" : "challenge";
}

async function verifyGoTrueResetOtp(email: string, token: string): Promise<void> {
  const types = ["recovery", "email", "magiclink"] as const;
  let lastMessage = "Invalid verification code.";
  for (const type of types) {
    const attempt = await supabase.auth.verifyOtp({ email, token, type });
    if (!attempt.error) return;
    lastMessage = attempt.error.message || lastMessage;
  }
  throw new Error(lastMessage);
}

export async function startPasswordResetByEmail(email: string): Promise<{
  emailToken: string;
  delivery: PasswordResetDelivery;
}> {
  const data = await invokeSignupVerification({
    action: "start_password_reset_by_email",
    email: email.trim().toLowerCase(),
  });
  return {
    emailToken: String(data.email_token ?? email.trim().toLowerCase()),
    delivery: parseDelivery(data.delivery),
  };
}

export async function resendPasswordResetByEmail(email: string): Promise<PasswordResetDelivery> {
  const data = await invokeSignupVerification({
    action: "resend_password_reset_by_email",
    email: email.trim().toLowerCase(),
    email_token: email.trim().toLowerCase(),
  });
  return parseDelivery(data.delivery);
}

export async function verifyPasswordResetCode(
  email: string,
  code: string,
  delivery: PasswordResetDelivery,
): Promise<void> {
  const trimmed = code.replace(/\D/g, "");
  if (delivery === "recovery") {
    await verifyGoTrueResetOtp(email.trim().toLowerCase(), trimmed);
    return;
  }

  await invokeSignupVerification({
    action: "verify_password_reset_otp",
    email_token: email.trim().toLowerCase(),
    code: trimmed,
  });
}

export async function setPasswordAfterReset(
  email: string,
  code: string,
  newPassword: string,
  delivery: PasswordResetDelivery,
): Promise<void> {
  const trimmed = code.replace(/\D/g, "");
  const cleanEmail = email.trim().toLowerCase();

  if (delivery === "recovery") {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message || "Failed to update password.");
    return;
  }

  await invokeSignupVerification({
    action: "verify_and_set_password",
    email_token: cleanEmail,
    code: trimmed,
    new_password: newPassword,
  });
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(1, name.length - visible.length))}@${domain}`;
}
