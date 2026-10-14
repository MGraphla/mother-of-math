-- Token / email learners can update only their own profile photo.
CREATE OR REPLACE FUNCTION public.update_student_photo_by_token(
  p_student_id UUID,
  p_access_token TEXT,
  p_photo_url TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_photo_url IS NULL OR length(trim(p_photo_url)) = 0 THEN
    RAISE EXCEPTION 'A photo URL is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM students
    WHERE id = p_student_id
      AND account_status = 'active'
      AND (
        (p_access_token IS NOT NULL AND p_access_token <> '' AND access_token = p_access_token)
        OR (auth.uid() IS NOT NULL AND auth_user_id = auth.uid())
      )
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive student credentials';
  END IF;

  UPDATE students
  SET profile_photo_url = p_photo_url, updated_at = now()
  WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_student_photo_by_token(UUID, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.update_student_photo_by_token(UUID, TEXT, TEXT) TO authenticated;
