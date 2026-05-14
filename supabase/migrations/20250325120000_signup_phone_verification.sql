-- OTP challenges for signup via Infobip (SMS / WhatsApp). Access only with service role (Edge Function).

CREATE TABLE IF NOT EXISTS public.signup_phone_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  destination_e164 text NOT NULL,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS signup_phone_verification_challenges_email_lower_key
  ON public.signup_phone_verification_challenges (lower(email));

CREATE INDEX IF NOT EXISTS signup_phone_verification_challenges_expires_idx
  ON public.signup_phone_verification_challenges (expires_at);

ALTER TABLE public.signup_phone_verification_challenges ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.signup_phone_verification_challenges IS 'OTP for Infobip SMS/WhatsApp signup; Edge Function uses service role only.';
