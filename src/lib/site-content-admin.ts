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

/** Live admin-action may still return Unknown action for get_site_content. */
export function isSiteContentActionMissing(error: string | undefined | null): boolean {
  const msg = String(error || '').toLowerCase();
  if (!msg) return false;
  if (msg.includes('unknown action')) return true;
  if (msg.includes('non-2xx') || msg.includes('functionshttperror')) return true;
  return (
    msg.includes('get_site_content') &&
    /not found|does not exist|could not find|unsupported|unrecognized/.test(msg)
  );
}

export type WebsiteTabLoad = {
  rows: SiteContentAdminRow[];
  via: 'get_site_content' | 'public_select' | 'none';
  actionMissing: boolean;
  error?: string;
};

/**
 * Website tab must never look like an empty CMS when get_site_content is missing.
 * Rows from public SELECT are fine; a missing action with zero rows is a warning, not an empty store.
 */
export function resolveWebsiteTabLoad(input: {
  adminResult?: { success: boolean; data?: unknown; error?: string };
  publicRows?: unknown;
  publicError?: string;
}): WebsiteTabLoad {
  const admin = input.adminResult;
  if (admin?.success) {
    return {
      rows: mapSiteContentAdminRows(admin.data),
      via: 'get_site_content',
      actionMissing: false,
    };
  }
  const actionMissing = isSiteContentActionMissing(admin?.error);
  const publicRows = mapSiteContentAdminRows(input.publicRows);
  if (!input.publicError && publicRows.length) {
    return {
      rows: publicRows,
      via: 'public_select',
      actionMissing,
      error: actionMissing ? admin?.error : undefined,
    };
  }
  return {
    rows: publicRows,
    via: 'none',
    actionMissing,
    error: admin?.error || input.publicError || 'Could not load site_content',
  };
}

export function websiteTabUnknownActionBanner(load: WebsiteTabLoad): string | null {
  if (!load.actionMissing) return null;
  if (load.via === 'get_site_content') return null;
  return 'HQ could not run get_site_content (Unknown action). This is not an empty site. Retry after the edge function has get_site_content. Talk and Prize still load.';
}

/** True only when the Website tab paints like a blank CMS (error-only or no Talk chrome). */
export function websiteTabLooksLikeEmptyCms(html: string): boolean {
  const text = String(html || '');
  if (!text.trim()) return true;
  const hasTalk = /id="owner-broadcast-panel"/.test(text) && /data-hq-talk="1"/.test(text);
  if (hasTalk) return false;
  if (/Error loading content/i.test(text)) return true;
  if (/No content entries yet/i.test(text)) return true;
  return !/Edit Site Content/.test(text);
}
