/**
 * Owner HQ site_content via admin-action.
 * Matches live JS: get_site_content → { success, data: rows[] } → key/id map.
 */

import { invokeAdminAction } from './admin-action-client';

export type SiteContentRow = {
  key?: string;
  id?: string;
  value?: unknown;
  updated_at?: string;
};

export function mapSiteContentRows(rows: unknown): Record<string, unknown> {
  if (!Array.isArray(rows)) return {};
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const rec = row as SiteContentRow;
    const key = rec.key ?? rec.id;
    if (key != null && String(key).trim()) out[String(key)] = rec.value;
  }
  return out;
}

export function normalizeSiteContentList(rows: unknown): Array<{ id: string; value?: unknown }> {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return { id: '' };
      const rec = row as SiteContentRow;
      return { id: String(rec.key ?? rec.id ?? ''), value: rec.value };
    })
    .filter((row) => row.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Live Eu(key?) — empty object when the action fails or data is not an array. */
export async function fetchAdminSiteContent(key?: string): Promise<Record<string, unknown>> {
  const trimmed = key && String(key).trim();
  const result = await invokeAdminAction<SiteContentRow[]>(
    'get_site_content',
    trimmed ? { key: trimmed } : {},
  );
  if (!result.success || !Array.isArray(result.data)) return {};
  return mapSiteContentRows(result.data);
}

/** Website tab — throw with live copy when the authorized read fails. */
export async function fetchAdminSiteContentRows(): Promise<SiteContentRow[]> {
  const result = await invokeAdminAction<SiteContentRow[]>('get_site_content');
  if (!result.success) {
    throw new Error(result.error || 'Could not load the website tab.');
  }
  return Array.isArray(result.data) ? result.data : [];
}
