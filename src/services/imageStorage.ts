// src/services/imageStorage.ts
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

// ─── Image Storage Service ────────────────────────────────────────────────────────
// Handles storing generated images in Supabase Storage and recording them in the Database

const BUCKET_NAME = "generated-images";
const TABLE_NAME = "generated_images";

interface StoredImage {
  id: string;
  user_id: string;
  prompt: string;
  enhanced_prompt: string;
  aspect_ratio: string;
  style: string;
  image_url: string;
  storage_path: string;
  is_favorite: boolean;
  created_at: string;
}

export const imageStorage = {
  /**
   * Uploads a base64 or blob image to Supabase Storage and creates a record in the database
   */
  async saveImage(
    base64Data: string, 
    metadata: {
      prompt: string;
      enhancedPrompt: string;
      aspectRatio: string;
      style: string;
    }
  ): Promise<StoredImage | null> {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not authenticated");

      // 1. Convert base64 to Blob
      const response = await fetch(base64Data);
      const blob = await response.blob();
      
      // 2. Upload to Storage
      const fileName = `${user.id}/${uuidv4()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, blob, {
          contentType: "image/png",
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

      // 4. Insert Record into Database
      const { data: insertData, error: insertError } = await supabase
        .from(TABLE_NAME)
        .insert({
          user_id: user.id,
          prompt: metadata.prompt,
          enhanced_prompt: metadata.enhancedPrompt,
          aspect_ratio: metadata.aspectRatio,
          style: metadata.style,
          image_url: publicUrl,
          storage_path: fileName,
          is_favorite: false
        })
        .select()
        .single();

      if (insertError) {
        // If DB insert fails, try to clean up the uploaded file
        await supabase.storage.from(BUCKET_NAME).remove([fileName]);
        console.error("Database insert error:", insertError);
        throw insertError;
      }

      return insertData as StoredImage;
    } catch (error) {
      console.error("Failed to save image:", error);
      return null;
    }
  },

  /**
   * Fetches all generated images for the current user
   */
  async getImages(): Promise<StoredImage[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch images:", error);
      return [];
    }

    return data as StoredImage[];
  },

  /**
   * Deletes an image from both Storage and Database
   */
  async deleteImage(id: string, storagePath: string): Promise<boolean> {
    try {
      // 1. Delete from Storage
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([storagePath]);
        
        if (storageError) console.warn("Storage deletion warning:", storageError);
      }

      // 2. Delete from Database
      const { error: dbError } = await supabase
        .from(TABLE_NAME)
        .delete()
        .eq("id", id);

      if (dbError) throw dbError;

      return true;
    } catch (error) {
      console.error("Failed to delete image:", error);
      return false;
    }
  },

  /**
   * Toggles the favorite status of an image
   */
  async toggleFavorite(id: string, isFavorite: boolean): Promise<boolean> {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ is_favorite: isFavorite })
      .eq("id", id);

    if (error) {
      console.error("Failed to update favorite status:", error);
      return false;
    }
    return true;
  }
};
