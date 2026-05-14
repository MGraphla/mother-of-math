-- Spoken feedback (ElevenLabs TTS) for assigned student work
ALTER TABLE student_works ADD COLUMN IF NOT EXISTS feedback_audio_url TEXT;
ALTER TABLE student_works ADD COLUMN IF NOT EXISTS feedback_audio_status TEXT;

COMMENT ON COLUMN student_works.feedback_audio_url IS 'Public URL to MP3 of spoken AI feedback (ElevenLabs)';
COMMENT ON COLUMN student_works.feedback_audio_status IS 'pending | ready | error | null';

-- Bucket for generated MP3s (public read so magic-link students can play audio)
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-feedback-audio', 'student-feedback-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can read (URLs are unguessable paths); writes only via service role (Edge Function)
DROP POLICY IF EXISTS "Public read student feedback audio" ON storage.objects;
CREATE POLICY "Public read student feedback audio"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'student-feedback-audio');

-- Recreate RPC so the returned row type includes new student_works columns (SELECT * shape stays in sync).
CREATE OR REPLACE FUNCTION get_works_for_student(p_access_token TEXT)
RETURNS SETOF student_works
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
BEGIN
  SELECT id INTO v_student_id
  FROM students
  WHERE access_token = p_access_token
    AND account_status = 'active';

  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT *
    FROM student_works
    WHERE student_id = v_student_id
    ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_works_for_student(TEXT) TO anon, authenticated;
