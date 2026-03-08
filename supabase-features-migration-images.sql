
-- ============================================================
-- GENERATED IMAGES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS generated_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  prompt TEXT NOT NULL,
  enhanced_prompt TEXT,
  aspect_ratio TEXT NOT NULL,
  style TEXT,
  image_url TEXT NOT NULL, -- Will store the Supabase Storage URL
  storage_path TEXT,       -- Path in the storage bucket
  
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert their own images" ON generated_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own images" ON generated_images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own images" ON generated_images
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own images" ON generated_images
  FOR DELETE USING (auth.uid() = user_id);

-- Create Storage Bucket for Images (if possible via SQL, otherwise must be done in Dashboard)
-- Attempting to create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-images', 'generated-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Users can upload their own images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'generated-images' AND 
    auth.uid() = owner
  );

CREATE POLICY "Users can view their own images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'generated-images' AND 
    auth.uid() = owner
  );
  
CREATE POLICY "Users can delete their own images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'generated-images' AND 
    auth.uid() = owner
  );

CREATE POLICY "Anyone can view public images" ON storage.objects
  FOR SELECT USING ( bucket_id = 'generated-images' );
