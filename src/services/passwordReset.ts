import { supabase } from '@/lib/supabase';
import { invokeSignupVerification } from '@/services/signupVerification';

/**
 * Password reset by 6-digit code (same flow as the mobile app):
 *  - email: Supabase sends the "Reset password" email with {{ .Token }};
 *           verifying it signs the user in with a recovery session.
 *  - sms:   the signup-verification Edge Function sends and checks the code.
 */

export type ResetTicket =
  | { channel: 'email'; email: string }
  | { channel: 'sms'; resetId: string; maskedPhone: string };

export async function startEmailReset(email: string): Promise<ResetTicket> {
  const clean = email.trim().toLowerCase();
  await invokeSignupVerification({ action: 'start_password_reset_by_email', email: clean });
  return { channel: 'email', email: clean };
}

export async function startPhoneReset(phone: string, country: string): Promise<ResetTicket> {
  const data = await invokeSignupVerification({
    action: 'start_password_reset_by_phone',
    phone: phone.trim(),
    country,
  });
  return {
    channel: 'sms',
    resetId: String(data.reset_id ?? ''),
    maskedPhone: String(data.masked_phone ?? ''),
  };
}

export async function resendReset(ticket: ResetTicket): Promise<void> {
  if (ticket.channel === 'email') {
    await invokeSignupVerification({ action: 'resend_password_reset_by_email', email: ticket.email });
    return;
  }
  await invokeSignupVerification({ action: 'resend_password_reset_by_phone', reset_id: ticket.resetId });
}

/** Email codes create a recovery session; SMS codes are only checked here (consumed on save). */
export async function verifyResetCode(ticket: ResetTicket, code: string): Promise<void> {
  const token = code.replace(/\D/g, '');
  if (ticket.channel === 'sms') {
    await invokeSignupVerification({ action: 'verify_password_reset_otp', reset_id: ticket.resetId, code: token });
    return;
  }
  const { error } = await supabase.auth.verifyOtp({ email: ticket.email, token, type: 'recovery' });
  if (error) throw error;
}

/** Saves the new password and leaves the user signed in. */
export async function saveNewPassword(ticket: ResetTicket, code: string, password: string): Promise<void> {
  if (ticket.channel === 'email') {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    return;
  }
  const data = await invokeSignupVerification({
    action: 'verify_and_set_password',
    reset_id: ticket.resetId,
    code: code.replace(/\D/g, ''),
    new_password: password,
  });
  const email = String(data.email ?? '');
  if (email) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
}
