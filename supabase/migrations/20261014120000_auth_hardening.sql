-- ============================================================================
-- Auth hardening
--
-- 1. Profiles are created by the database the moment an account is verified
--    (email code, SMS code, Google, or admin-created) instead of relying on
--    browser storage surviving the verify step.
-- 2. Users can no longer promote themselves (e.g. to `admin`) by editing
--    their own profile row; `email` always mirrors the auth account.
-- 3. Service-role helpers for the signup-verification Edge Function:
--    fast email lookup (no paging through every user) and rate limiting.
-- 4. Backfill: verified accounts that never got a profile row.
--
-- Safe to re-run.
-- ============================================================================

-- ── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._meta_text(meta jsonb, key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT nullif(btrim(meta ->> key), '');
$$;

CREATE OR REPLACE FUNCTION public._meta_int(meta jsonb, key text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN (meta ->> key) ~ '^\s*\d{1,6}\s*$' THEN btrim(meta ->> key)::integer
    ELSE NULL
  END;
$$;

-- ── Profile creation from auth.users ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_profile_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  u        auth.users%ROWTYPE;
  meta     jsonb;
  provider text;
  is_oauth boolean;
  v_role   text;
  v_name   text;
BEGIN
  SELECT * INTO u FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Students live in public.students and never get a profiles row here.
  IF EXISTS (SELECT 1 FROM public.students s WHERE s.auth_user_id = p_user_id) THEN
    RETURN;
  END IF;

  meta     := coalesce(u.raw_user_meta_data, '{}'::jsonb);
  provider := coalesce(u.raw_app_meta_data ->> 'provider', 'email');
  is_oauth := provider <> 'email' AND provider <> 'phone';

  -- Only the two self-service roles can come from client-supplied metadata.
  v_role := CASE WHEN public._meta_text(meta, 'role') = 'parent' THEN 'parent' ELSE 'teacher' END;

  v_name := coalesce(
    public._meta_text(meta, 'full_name'),
    public._meta_text(meta, 'name'),
    split_part(coalesce(u.email, ''), '@', 1),
    'Mama Math user'
  );

  INSERT INTO public.profiles (
    id, email, full_name, role, gender, country, city,
    school_name, school_address, school_type,
    number_of_students, number_of_classes, subjects_taught, grade_levels,
    years_of_experience, education_level, phone_number, whatsapp_number,
    bio, date_of_birth, preferred_language, avatar_url,
    google_extra_profile_completed, created_at, updated_at
  ) VALUES (
    u.id,
    coalesce(u.email, ''),
    left(v_name, 200),
    v_role,
    public._meta_text(meta, 'gender'),
    public._meta_text(meta, 'country'),
    public._meta_text(meta, 'city'),
    public._meta_text(meta, 'school_name'),
    public._meta_text(meta, 'school_address'),
    public._meta_text(meta, 'school_type'),
    public._meta_int(meta, 'number_of_students'),
    public._meta_int(meta, 'number_of_classes'),
    public._meta_text(meta, 'subjects_taught'),
    public._meta_text(meta, 'grade_levels'),
    public._meta_int(meta, 'years_of_experience'),
    public._meta_text(meta, 'education_level'),
    public._meta_text(meta, 'phone_number'),
    public._meta_text(meta, 'whatsapp_number'),
    public._meta_text(meta, 'bio'),
    public._meta_text(meta, 'date_of_birth'),
    coalesce(public._meta_text(meta, 'preferred_language'), 'English'),
    coalesce(public._meta_text(meta, 'avatar_url'), public._meta_text(meta, 'picture')),
    -- OAuth accounts owe the one-time "complete profile" step.
    NOT is_oauth,
    coalesce(u.created_at, now()),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.create_profile_for_user(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_auth_user_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.email_confirmed_at IS NULL) THEN
    BEGIN
      PERFORM public.create_profile_for_user(NEW.id);
    EXCEPTION WHEN others THEN
      -- Never block sign-in because of a profile problem; the app retries via ensure_my_profile().
      RAISE WARNING 'create_profile_for_user(%) failed: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_auth_user_verified() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_verified_insert ON auth.users;
CREATE TRIGGER on_auth_user_verified_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_verified();

DROP TRIGGER IF EXISTS on_auth_user_verified_update ON auth.users;
CREATE TRIGGER on_auth_user_verified_update
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_verified();

-- Called by the apps after sign-in; idempotent. Returns the caller's profile row.
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid)
     AND EXISTS (SELECT 1 FROM auth.users WHERE id = uid AND email_confirmed_at IS NOT NULL) THEN
    PERFORM public.create_profile_for_user(uid);
  END IF;
  RETURN QUERY SELECT * FROM public.profiles WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

-- ── Guard privileged profile columns ────────────────────────────────────────

-- SECURITY INVOKER on purpose: `current_user` is the API role for direct
-- client writes, and the owner role for SECURITY DEFINER admin RPCs / triggers.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'teacher' AND NEW.role IS DISTINCT FROM 'parent' THEN
      RAISE EXCEPTION 'You can only create a teacher or parent profile.'
        USING ERRCODE = '42501';
    END IF;
    -- RLS limits writes to the caller's own row, so their JWT email is authoritative.
    NEW.email := coalesce(nullif(auth.jwt() ->> 'email', ''), NEW.email);
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Profile id cannot change.' USING ERRCODE = '42501';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     AND NOT (OLD.role IN ('teacher', 'parent') AND NEW.role IN ('teacher', 'parent')) THEN
    RAISE EXCEPTION 'You are not allowed to change this role.' USING ERRCODE = '42501';
  END IF;
  NEW.email := coalesce(nullif(auth.jwt() ->> 'email', ''), OLD.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- ── Edge Function helpers (service role only) ───────────────────────────────

CREATE OR REPLACE FUNCTION public.auth_user_by_email(p_email text)
RETURNS TABLE (id uuid, email_confirmed boolean, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id, u.email_confirmed_at IS NOT NULL, u.created_at
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_by_email(text) TO service_role;

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  bucket       text PRIMARY KEY,
  hits         integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) touches this table.

-- Returns TRUE when the action is allowed (and records the hit).
CREATE OR REPLACE FUNCTION public.auth_rate_limit_hit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hits integer;
BEGIN
  INSERT INTO public.auth_rate_limits AS r (bucket, hits, window_start)
  VALUES (p_bucket, 1, now())
  ON CONFLICT (bucket) DO UPDATE
    SET hits = CASE
          WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN 1
          ELSE r.hits + 1
        END,
        window_start = CASE
          WHEN r.window_start < now() - make_interval(secs => p_window_seconds) THEN now()
          ELSE r.window_start
        END
  RETURNING hits INTO v_hits;

  -- Opportunistic cleanup of long-expired buckets.
  IF random() < 0.01 THEN
    DELETE FROM public.auth_rate_limits WHERE window_start < now() - interval '2 days';
  END IF;

  RETURN v_hits <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.auth_rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_rate_limit_hit(text, integer, integer) TO service_role;

-- ── Backfill verified accounts without a profile ────────────────────────────

DO $$
DECLARE
  r record;
  notify_trigger_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass AND tgname = 'trigger_new_teacher_signup'
  ) INTO notify_trigger_exists;

  -- Don't flood the admin inbox with "new teacher" notices for old accounts.
  IF notify_trigger_exists THEN
    EXECUTE 'ALTER TABLE public.profiles DISABLE TRIGGER trigger_new_teacher_signup';
  END IF;

  FOR r IN
    SELECT u.id
    FROM auth.users u
    WHERE u.email_confirmed_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
  LOOP
    PERFORM public.create_profile_for_user(r.id);
  END LOOP;

  IF notify_trigger_exists THEN
    EXECUTE 'ALTER TABLE public.profiles ENABLE TRIGGER trigger_new_teacher_signup';
  END IF;
END $$;
