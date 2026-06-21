import { supabase } from './supabase';

export const BANNER_UPLOAD_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

export const BANNER_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

export const BANNER_UPLOAD_ACCEPT = BANNER_UPLOAD_ALLOWED_TYPES.join(',');

/** Returns an error message when invalid, or null when the file is OK to upload. */
export function validateBannerImageFile(file: File): string | null {
  if (!file) return 'No file selected';
  if (!BANNER_UPLOAD_ALLOWED_TYPES.includes(file.type as (typeof BANNER_UPLOAD_ALLOWED_TYPES)[number])) {
    return 'Use JPG, PNG, GIF, WebP, or SVG';
  }
  if (file.size <= 0 || file.size > BANNER_UPLOAD_MAX_BYTES) {
    return 'Image must be 2MB or smaller';
  }
  return null;
}

export function sanitizeBannerFileName(raw: string): string {
  const base = String(raw || 'banner')
    .split(/[/\\]/)
    .pop()!
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return base || 'banner';
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read image file'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

/** Upload a banner image via the secured admin-action Edge Function. Returns the public URL. */
export async function uploadBannerImage(file: File): Promise<string> {
  const validationError = validateBannerImageFile(file);
  if (validationError) throw new Error(validationError);

  const adminSecret = import.meta.env.VITE_ADMIN_ACTION_SECRET || '';
  if (!adminSecret) {
    throw new Error('Admin upload secret is not configured (VITE_ADMIN_ACTION_SECRET)');
  }

  const data = await fileToBase64(file);
  const invokeOpts: {
    body: {
      action: string;
      payload: { fileName: string; contentType: string; data: string };
    };
    headers: Record<string, string>;
  } = {
    body: {
      action: 'upload_banner_image',
      payload: {
        fileName: sanitizeBannerFileName(file.name),
        contentType: file.type,
        data,
      },
    },
    headers: { 'x-admin-secret': adminSecret },
  };

  const { data: response, error } = await supabase.functions.invoke('admin-action', invokeOpts);
  if (error) throw error;
  if (!response?.success || !response?.url) {
    throw new Error(response?.error || 'Banner upload failed');
  }
  return String(response.url);
}