import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../lib/supabase";

export const RESOURCE_TOPICS = [
  "Addition",
  "Subtraction",
  "Multiplication",
  "Division",
  "Fractions",
  "Decimals",
  "Geometry",
  "Algebra",
  "Word Problems",
  "Other",
] as const;

export type ResourceFileType =
  | "pdf"
  | "image"
  | "video"
  | "link"
  | "document"
  | "audio"
  | "spreadsheet";

export interface ResourceRow {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  url?: string | null;
  file_type: string | null;
  thumbnail_url?: string | null;
  topic: string | null;
  grade_level: string | null;
  is_public?: boolean | null;
  created_at: string;
  view_count?: number | null;
  download_count?: number | null;
}

const decodeBase64ToBytes = (base64: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const detectFileType = (
  urlOrName: string,
  mimeType?: string,
): ResourceFileType => {
  const lower = (urlOrName || "").toLowerCase();
  if (/youtube\.com|youtu\.be|vimeo\.com/.test(lower)) return "video";
  if (mimeType?.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif)$/i.test(lower))
    return "image";
  if (mimeType?.startsWith("video/") || /\.(mp4|mov|webm|m4v)$/i.test(lower)) return "video";
  if (mimeType?.startsWith("audio/") || /\.(mp3|wav|m4a|aac)$/i.test(lower)) return "audio";
  if (/\.pdf$/i.test(lower)) return "pdf";
  if (/\.(xls|xlsx|csv)$/i.test(lower)) return "spreadsheet";
  if (/^https?:\/\//i.test(lower) && !/\.[a-z0-9]{2,4}(\?|$)/i.test(lower)) return "link";
  return "document";
};

export const listResourcesForTeacher = async (teacherId: string): Promise<ResourceRow[]> => {
  const { data, error } = await supabase
    .from("resources")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ResourceRow[];
};

export const getTeacherResourceTopics = async (teacherId: string): Promise<string[]> => {
  const rows = await listResourcesForTeacher(teacherId);
  return Array.from(
    new Set(rows.map((r) => r.topic).filter((t): t is string => !!t && t.trim().length > 0)),
  ).sort();
};

export const createResource = async (input: {
  teacher_id: string;
  title: string;
  description?: string | null;
  file_url?: string | null;
  url?: string | null;
  file_type?: string;
  thumbnail_url?: string | null;
  topic?: string | null;
  grade_level?: string | null;
  is_public?: boolean;
}) => {
  const fileUrl = input.file_url ?? input.url ?? null;
  const fileType = input.file_type || (fileUrl ? detectFileType(fileUrl) : "document");
  const thumbnail =
    input.thumbnail_url !== undefined
      ? input.thumbnail_url
      : fileType === "image"
        ? fileUrl
        : null;

  const { data, error } = await supabase
    .from("resources")
    .insert({
      teacher_id: input.teacher_id,
      title: input.title,
      description: input.description ?? null,
      file_url: fileUrl,
      file_type: fileType,
      thumbnail_url: thumbnail,
      topic: input.topic ?? null,
      grade_level: input.grade_level ?? null,
      is_public: input.is_public ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ResourceRow;
};

export const updateResource = async (
  id: string,
  input: {
    title?: string;
    description?: string | null;
    file_url?: string | null;
    file_type?: string;
    thumbnail_url?: string | null;
    topic?: string | null;
    grade_level?: string | null;
  },
) => {
  const { data, error } = await supabase
    .from("resources")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ResourceRow;
};

export const deleteResource = async (id: string) => {
  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) throw error;
};

export const uploadResourceFile = async (input: {
  teacherId: string;
  uri: string;
  fileName: string;
  mimeType?: string;
}): Promise<{ file_url: string; file_type: ResourceFileType }> => {
  const info = await FileSystem.getInfoAsync(input.uri);
  if (!info.exists) throw new Error("That file is no longer available. Please pick it again.");
  if ("size" in info && typeof info.size === "number" && info.size > 50 * 1024 * 1024) {
    throw new Error("File is too large (max 50MB).");
  }

  const base64 = await FileSystem.readAsStringAsync(input.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const safeName = input.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `resources/${input.teacherId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from("assignment-files")
    .upload(path, decodeBase64ToBytes(base64), {
      contentType: input.mimeType || "application/octet-stream",
    });
  if (error) throw error;

  const file_url = supabase.storage.from("assignment-files").getPublicUrl(path).data.publicUrl;
  return { file_url, file_type: detectFileType(input.fileName, input.mimeType) };
};

export const listResourcesForTeacherId = listResourcesForTeacher;
