/**
 * Owner HQ Website tab — site_content rows from admin-action.
 * UI expects { success: true, data: [{ key|id, value }, ...] }.
 */

export type SiteContentAdminRow = {
  key: string;
  id: string;
  value: unknown;
  description?: unknown;
  updated_at?: unknown;
};

export function mapSiteContentAdminRows(raw: unknown): SiteContentAdminRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const rec = row as Record<string, unknown>;
      const key = String(rec.key ?? rec.id ?? '').trim();
      if (!key) return null;
      return {
        key,
        id: key,
        value: rec.value,
        description: rec.description ?? null,
        updated_at: rec.updated_at ?? null,
      };
    })
    .filter((row): row is SiteContentAdminRow => row !== null)
    .sort((a, b) => a.key.localeCompare(b.key));
}

export function siteContentAdminEnvelope(raw: unknown): {
  success: true;
  data: SiteContentAdminRow[];
} {
  return { success: true, data: mapSiteContentAdminRows(raw) };
}
