/**
 * Normalize site_content JSONB values for safe public text display.
 * Handles legacy double-encoded JSON strings from early seeds/migrations.
 */
export function normalizeSiteContentText(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object') return JSON.stringify(value);

  let text = String(value).trim();
  if (!text) return null;

  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') text = parsed.trim();
    } catch {
      text = text.slice(1, -1).trim();
    }
  }

  return text || null;
}