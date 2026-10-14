import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";

const BUCKET_NAME = "generated-images";
const TABLE_NAME = "generated_images";

export interface StoredImage {
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

const decodeBase64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const stripDataUrlPrefix = (dataUrl: string) => {
  const idx = dataUrl.indexOf("base64,");
  return idx >= 0 ? dataUrl.slice(idx + 7) : dataUrl;
};

const normalizeStoragePath = (raw: string | null | undefined): string | null => {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  const marker = `/object/public/${BUCKET_NAME}/`;
  const idx = t.indexOf(marker);
  if (idx !== -1) return t.slice(idx + marker.length).split("?")[0] ?? null;
  if (t.startsWith(`${BUCKET_NAME}/`)) return t.slice(BUCKET_NAME.length + 1);
  return t;
};

export const imageStorage = {
  async getGenerationsCountToday(): Promise<number> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count, error } = await supabase
      .from(TABLE_NAME)
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());
    if (error) return 0;
    return count || 0;
  },

  async getImages(): Promise<StoredImage[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as StoredImage[];
  },

  async saveImage(
    imageDataUrl: string,
    metadata: {
      prompt: string;
      enhancedPrompt: string;
      aspectRatio: string;
      style: string;
    },
  ): Promise<StoredImage | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    let bytes: Uint8Array;
    if (imageDataUrl.startsWith("data:")) {
      bytes = decodeBase64ToBytes(stripDataUrlPrefix(imageDataUrl));
    } else if (imageDataUrl.startsWith("http")) {
      const dest = `${FileSystem.cacheDirectory}gen-${Date.now()}.png`;
      await FileSystem.downloadAsync(imageDataUrl, dest);
      const b64 = await FileSystem.readAsStringAsync(dest, {
        encoding: FileSystem.EncodingType.Base64,
      });
      bytes = decodeBase64ToBytes(b64);
    } else {
      bytes = decodeBase64ToBytes(imageDataUrl);
    }

    const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, bytes, { contentType: "image/png", upsert: false });
    if (uploadError) throw uploadError;

    const publicUrl = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName).data.publicUrl;
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        user_id: user.id,
        prompt: metadata.prompt,
        enhanced_prompt: metadata.enhancedPrompt,
        aspect_ratio: metadata.aspectRatio,
        style: metadata.style,
        image_url: publicUrl,
        storage_path: fileName,
        is_favorite: false,
      })
      .select()
      .single();

    if (error) {
      await supabase.storage.from(BUCKET_NAME).remove([fileName]);
      throw error;
    }
    return data as StoredImage;
  },

  async deleteImage(id: string, storagePath: string | null | undefined): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const path = normalizeStoragePath(storagePath);
    if (path) {
      await supabase.storage.from(BUCKET_NAME).remove([path]);
    }
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");
    if (error) throw error;
    return !!data?.length;
  },

  async toggleFavorite(id: string, isFavorite: boolean): Promise<boolean> {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ is_favorite: isFavorite })
      .eq("id", id);
    if (error) throw error;
    return true;
  },
};
