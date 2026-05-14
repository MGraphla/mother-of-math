-- Accurate analytics + AI featured image pipeline for resources
ALTER TABLE resources ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS featured_image_status TEXT;

COMMENT ON COLUMN resources.featured_image_status IS 'pending | ready | error | skipped — AI-generated cover for non-image resources';

CREATE OR REPLACE FUNCTION public.increment_resource_download(p_resource_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE resources
  SET
    download_count = COALESCE(download_count, 0) + 1,
    updated_at = now()
  WHERE id = p_resource_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_resource_view(p_resource_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE resources
  SET
    view_count = COALESCE(view_count, 0) + 1,
    updated_at = now()
  WHERE id = p_resource_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_resource_download(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_resource_download(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_resource_view(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_resource_view(UUID) TO anon;
