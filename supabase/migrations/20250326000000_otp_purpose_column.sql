-- Add purpose column to distinguish signup vs password-reset OTP challenges.
-- Existing rows default to 'signup'.

ALTER TABLE public.signup_phone_verification_challenges
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'signup'
    CHECK (purpose IN ('signup', 'password_reset'));

CREATE INDEX IF NOT EXISTS signup_phone_verification_challenges_purpose_idx
  ON public.signup_phone_verification_challenges (purpose);

COMMENT ON COLUMN public.signup_phone_verification_challenges.purpose IS
  'signup = email/phone sign-up OTP; password_reset = phone-based password reset OTP.';
