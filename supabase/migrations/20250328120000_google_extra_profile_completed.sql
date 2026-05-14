-- One-time Google OAuth onboarding: Complete Profile wizard only until this is true.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_extra_profile_completed BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.google_extra_profile_completed IS
  'If false, Google sign-in user must finish /complete-profile once. Email/password signups set true at registration. Never set back to false after onboarding.';
