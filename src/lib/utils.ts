import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── File Upload Validation ─────────────────────────────

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
const ALLOWED_DOC_TYPES = ['application/pdf', ...ALLOWED_IMAGE_TYPES];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: File): FileValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit.` };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, AVIF.' };
  }
  return { valid: true };
}

export function validateUploadFile(file: File): FileValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit.` };
  }
  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, AVIF, PDF.' };
  }
  return { valid: true };
}

const interviewCovers = [
  '/covers/cover1.svg',
  '/covers/cover2.svg',
  '/covers/cover3.svg',
  '/covers/cover4.svg',
];

export const getRandomInterviewCover = () => {
  return interviewCovers[Math.floor(Math.random() * interviewCovers.length)];
};
