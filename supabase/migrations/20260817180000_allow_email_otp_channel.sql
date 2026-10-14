-- Allow password-reset OTPs to be emailed (channel = email) in addition to SMS/WhatsApp.

ALTER TABLE public.signup_phone_verification_challenges
  DROP CONSTRAINT IF EXISTS signup_phone_verification_challenges_channel_check;

ALTER TABLE public.signup_phone_verification_challenges
  ADD CONSTRAINT signup_phone_verification_challenges_channel_check
  CHECK (channel = ANY (ARRAY['sms'::text, 'whatsapp'::text, 'email'::text]));

COMMENT ON COLUMN public.signup_phone_verification_challenges.channel IS
  'sms/whatsapp for phone OTP; email for password-reset codes sent to the account inbox.';
