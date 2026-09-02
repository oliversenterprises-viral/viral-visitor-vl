/**
 * Owner HQ Website tab — site_content via admin-action.
 * Live admin-action at 8a24705 never registered get_site_content ("Unknown action").
 */

export function isUnknownAdminAction(error: string | undefined | null): boolean {
  return /unknown action/i.test(String(error || ''));
}

export class SiteContentAdminError extends Error {
  readonly code: 'unknown_action' | 'failed';
  constructor(message: string, code: 'unknown_action' | 'failed' = 'failed') {
    super(message);
    this.name = 'SiteContentAdminError';
    this.code = code;
  }
}

export type SiteContentAdminRow = {
  key?: string;
  id?: string;
  value?: unknown;
  updated_at?: string;
};

export function normalizeSiteContentAdminRows(
  rows: SiteContentAdminRow[],
): Array<{ id: string; value?: unknown }> {
  return rows
    .map((row) => ({
      id: String(row.key ?? row.id ?? ''),
      value: row.value,
    }))
    .filter((row) => row.id)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Live stale admin-action returns { success: false, error: 'Unknown action' }.
 * That must fail — never look like an empty Website tab.
 */
export function parseGetSiteContentResult(result: {
  success: boolean;
  data?: unknown;
  error?: string;
}): SiteContentAdminRow[] {
  if (!result.success) {
    if (isUnknownAdminAction(result.error)) {
      throw new SiteContentAdminError(
        'Unknown action — admin-action is missing get_site_content',
        'unknown_action',
      );
    }
    throw new SiteContentAdminError(result.error || 'get_site_content failed', 'failed');
  }
  if (!Array.isArray(result.data)) {
    throw new SiteContentAdminError('get_site_content returned no data array', 'failed');
  }
  return result.data as SiteContentAdminRow[];
}
