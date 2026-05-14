/**
 * Resources Library Service
 * Teacher uploads learning materials students can access anytime
 */

import { supabase } from '@/lib/supabase';
import { getStudentSession } from './studentService';

// ── Types ─────────────────────────────────────────────────

export interface Resource {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  url: string | null;
  file_url: string | null;
  file_type: 'pdf' | 'image' | 'video' | 'link' | 'document' | 'audio';
  thumbnail_url: string | null;
  topic: string | null;
  grade_level: string | null;
  is_public: boolean;
  download_count: number;
  view_count?: number;
  featured_image_status?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  completion_rate?: number | null;
  rating_count?: number;
  rating_sum?: number;
  created_at: string;
  updated_at: string;
}

// ── Student Resources ─────────────────────────────────────

/** Get resources available to a student */
export const getResourcesForStudent = async (): Promise<Resource[]> => {
  const session = getStudentSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('teacher_id', session.teacher_id)
    .or(`grade_level.is.null,grade_level.eq.${session.grade_level}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching resources:', error);
    return [];
  }

  return data || [];
};

/** Get resources by topic */
export const getResourcesByTopic = async (topic: string): Promise<Resource[]> => {
  const session = getStudentSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('teacher_id', session.teacher_id)
    .eq('topic', topic)
    .or(`grade_level.is.null,grade_level.eq.${session.grade_level}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching resources by topic:', error);
    return [];
  }

  return data || [];
};

/** Get all unique topics available for students */
export const getStudentResourceTopics = async (): Promise<string[]> => {
  const session = getStudentSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('resources')
    .select('topic')
    .eq('teacher_id', session.teacher_id)
    .or(`grade_level.is.null,grade_level.eq.${session.grade_level}`)
    .order('topic');

  if (error) {
    console.error('Error fetching topics:', error);
    return [];
  }
  
  // Return unique non-null topics
  const topics = new Set<string>();
  (data || []).forEach(item => {
    if (item.topic) topics.add(item.topic);
  });
  
  return Array.from(topics);
};

/** Increment download count (RPC; requires migration `increment_resource_download`) */
export const incrementResourceDownload = async (resourceId: string): Promise<void> => {
  const { error } = await supabase.rpc('increment_resource_download', {
    p_resource_id: resourceId,
  });
  if (error) {
    console.warn('increment_resource_download failed', error);
  }
};

/** @deprecated use incrementResourceDownload */
export const incrementDownloadCount = incrementResourceDownload;

/** Increment in-app preview / open count */
export const incrementResourceView = async (resourceId: string): Promise<void> => {
  const { error } = await supabase.rpc('increment_resource_view', {
    p_resource_id: resourceId,
  });
  if (error) {
    console.warn('increment_resource_view failed', error);
  }
};

// ── Teacher Resources ─────────────────────────────────────

/** Get all resources for a teacher */
export const getResourcesForTeacher = async (): Promise<Resource[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('resources')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching resources:', error);
    return [];
  }

  return data || [];
};

/** Upload a resource file to storage */
export const uploadResourceFile = async (
  file: File,
  teacherId: string
): Promise<string> => {
  const ext = file.name.split('.').pop() || 'file';
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `resources/${teacherId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from('assignment-files')
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) {
    console.error('Error uploading resource:', error);
    throw new Error('Failed to upload resource file');
  }

  const { data: urlData } = supabase.storage
    .from('assignment-files')
    .getPublicUrl(path);

  return urlData.publicUrl;
};

/** Create a new resource */
export const createResource = async (params: {
  title: string;
  description?: string;
  fileUrl: string;
  fileType?: Resource['file_type'];
  thumbnailUrl?: string | null;
  topic?: string;
  gradeLevel?: string;
  isPublic?: boolean;
  featuredImageStatus?: string | null;
}): Promise<Resource | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const fileType = params.fileType || detectFileType(params.fileUrl);
  const thumbnailUrl =
    params.thumbnailUrl !== undefined
      ? params.thumbnailUrl
      : fileType === 'image'
        ? params.fileUrl
        : null;

  const { data, error } = await supabase
    .from('resources')
    .insert({
      teacher_id: user.id,
      title: params.title,
      description: params.description || null,
      file_url: params.fileUrl,
      file_type: fileType,
      thumbnail_url: thumbnailUrl,
      topic: params.topic || null,
      grade_level: params.gradeLevel || null,
      is_public: params.isPublic || false,
      featured_image_status: params.featuredImageStatus ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating resource:', error);
    throw new Error('Failed to create resource');
  }

  return data;
};

/** Update a resource */
export const updateResource = async (
  resourceId: string,
  params: {
    title?: string;
    description?: string | null;
    fileUrl?: string;
    fileType?: Resource['file_type'];
    thumbnailUrl?: string | null;
    topic?: string | null;
    gradeLevel?: string | null;
    isPublic?: boolean;
    featuredImageStatus?: string | null;
  }
): Promise<Resource | null> => {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  
  if (params.title !== undefined) updateData.title = params.title;
  if (params.description !== undefined) updateData.description = params.description;
  if (params.fileUrl !== undefined) updateData.file_url = params.fileUrl;
  if (params.fileType !== undefined) updateData.file_type = params.fileType;
  if (params.thumbnailUrl !== undefined) updateData.thumbnail_url = params.thumbnailUrl;
  if (params.topic !== undefined) updateData.topic = params.topic;
  if (params.gradeLevel !== undefined) updateData.grade_level = params.gradeLevel;
  if (params.isPublic !== undefined) updateData.is_public = params.isPublic;
  if (params.featuredImageStatus !== undefined) updateData.featured_image_status = params.featuredImageStatus;

  const { data, error } = await supabase
    .from('resources')
    .update(updateData)
    .eq('id', resourceId)
    .select()
    .single();

  if (error) {
    console.error('Error updating resource:', error);
    throw new Error('Failed to update resource');
  }

  return data;
};

/** Delete a resource */
export const deleteResource = async (resourceId: string): Promise<void> => {
  const { error } = await supabase
    .from('resources')
    .delete()
    .eq('id', resourceId);

  if (error) {
    console.error('Error deleting resource:', error);
    throw new Error('Failed to delete resource');
  }
};

// ── Helpers ───────────────────────────────────────────────

/** Detect file type from URL or MIME type */
export const detectFileType = (url: string, mimeType?: string): Resource['file_type'] => {
  const lower = url.toLowerCase();
  
  // Check MIME type first if provided
  if (mimeType) {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('text')) return 'document';
  }
  
  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(jpg|jpeg|png|gif|webp|avif|svg)/.test(lower)) return 'image';
  if (/\.(mp4|webm|mov|avi)/.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|aac)/.test(lower)) return 'audio';
  if (/\.(doc|docx|txt|rtf)/.test(lower)) return 'document';
  if (lower.includes('youtube.com') || lower.includes('vimeo.com')) return 'video';
  if (lower.startsWith('http')) return 'link';
  return 'document';
};

/** Get file type icon */
export const getFileTypeIcon = (type: Resource['file_type']): string => {
  switch (type) {
    case 'pdf': return '📄';
    case 'image': return '🖼️';
    case 'video': return '🎬';
    case 'audio': return '🎵';
    case 'document': return '📝';
    case 'link': return '🔗';
    default: return '📁';
  }
};

/** Get unique topics from resources for a teacher */
export const getTeacherResourceTopics = async (): Promise<string[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('resources')
    .select('topic')
    .eq('teacher_id', user.id)
    .not('topic', 'is', null);

  if (error) {
    console.error('Error fetching topics:', error);
    return [];
  }

  const topics = new Set<string>();
  (data || []).forEach(r => {
    if (r.topic) topics.add(r.topic);
  });

  return Array.from(topics).sort();
};
