import { MESSAGES } from '../../src/lib/i18n/messages';
import type { Locale } from '../../src/lib/i18n/locales';
import {
  HOMEPAGE_SEO,
  OG_LOCALE,
  SEO_DEFAULT_ORIGIN,
  SEO_THEME_COLOR,
  buildHomepageJsonLd,
  isRtlSeoLocale,
  languageUrl,
  localeFromSearch,
  ogImageUrl,
  type SeoLocale,
} from '../../src/lib/organic-seo';

const TITLE_KEYS = ['hero.title_line1', 'hero.title_line2_lead', 'hero.title_accent'] as const;

function homepageTitle(locale: SeoLocale): string {
  if (locale === 'en') return HOMEPAGE_SEO.title;
  const d = MESSAGES[locale as Locale];
  const line1 = d['hero.title_line1'];
  const lead = d['hero.title_line2_lead'];
  const accent = d['hero.title_accent'];
  return `${line1} ${lead} ${accent}`.replace(/\s+/g, ' ').trim();
}

function homepageDescription(locale: SeoLocale): string {
  if (locale === 'en') return HOMEPAGE_SEO.description;
  return MESSAGES[locale as Locale]['hero.subtitle_drop'] || HOMEPAGE_SEO.description;
}

function rewriteDefaultOrigin(html: string, origin: string): string {
  if (origin === SEO_DEFAULT_ORIGIN) return html;
  return html.split(SEO_DEFAULT_ORIGIN).join(origin);
}

function applyI18nToHtml(html: string, locale: SeoLocale): string {
  if (locale === 'en') return html;
  const dict = MESSAGES[locale as Locale];
  return html.replace(
    /(<[^>]*\sdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/)/g,
    (full, open: string, key: string, inner: string, close: string) => {
      const next = dict[key as keyof typeof dict];
      if (!next) return full;
      if (/\sdata-i18n-text/.test(inner) || /<span data-i18n-text/.test(inner)) {
        const replaced = inner.replace(
          /(<[^>]*data-i18n-text[^>]*>)([\s\S]*?)(<\/)/,
          `$1${next}$3`,
        );
        return `${open}${replaced}${close}`;
      }
      if (/<[a-z]/i.test(inner)) return full;
      return `${open}${next}${close}`;
    },
  );
}

export function decorateHomepageHtml(html: string, pageUrl: URL): string {
  const origin = pageUrl.origin.replace(/\/$/, '');
  const locale = localeFromSearch(pageUrl.searchParams) || 'en';
  const canonical = languageUrl(origin, '/', locale === 'en' ? null : locale);
  const title = homepageTitle(locale);
  const desc = homepageDescription(locale);
  const ogTitle = locale === 'en' ? HOMEPAGE_SEO.ogTitle : title;
  const ogDesc = locale === 'en' ? HOMEPAGE_SEO.ogDescription : desc;
  const image = ogImageUrl(origin);
  const jsonLd = JSON.stringify(buildHomepageJsonLd(origin));
  const dir = isRtlSeoLocale(locale) ? 'rtl' : 'ltr';
  const ogLocale = OG_LOCALE[locale];

  let out = rewriteDefaultOrigin(html, origin);
  out = applyI18nToHtml(out, locale);

  out = out.replace(/<html\b[^>]*>/i, `<html lang="${locale}" dir="${dir}">`);
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeTag(title)}</title>`);
  out = upsertMeta(out, 'name', 'description', desc);
  out = upsertMeta(out, 'property', 'og:url', canonical);
  out = upsertMeta(out, 'property', 'og:title', ogTitle);
  out = upsertMeta(out, 'property', 'og:description', ogDesc);
  out = upsertMeta(out, 'property', 'og:image', image);
  out = upsertMeta(out, 'property', 'og:locale', ogLocale);
  out = upsertMeta(out, 'name', 'twitter:url', canonical);
  out = upsertMeta(out, 'name', 'twitter:title', ogTitle);
  out = upsertMeta(out, 'name', 'twitter:description', ogDesc);
  out = upsertMeta(out, 'name', 'twitter:image', image);
  out = upsertMeta(out, 'name', 'theme-color', SEO_THEME_COLOR);
  out = out.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeAttr(canonical)}">`,
  );
  out = out.replace(
    /<script type="application\/ld\+json" id="vr-organic-jsonld">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json" id="vr-organic-jsonld">${jsonLd}</script>`,
  );

  void TITLE_KEYS;
  return out;
}

function upsertMeta(html: string, attr: 'name' | 'property', key: string, content: string): string {
  const re = new RegExp(`<meta\\s+${attr}="${key}"[^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escapeAttr(content)}">`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `    ${tag}\n</head>`);
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeTag(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

export type HomepageAssets = { fetch: (request: Request) => Promise<Response> };

export async function serveDecoratedHomepage(
  request: Request,
  assets: HomepageAssets | undefined,
  next: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  if (!assets) return next();
  try {
    const assetReq = new Request(new URL('/index.html', url.origin), request);
    const asset = await assets.fetch(assetReq);
    if (!asset.ok) return next();
    const html = decorateHomepageHtml(await asset.text(), url);
    const headers = new Headers(asset.headers);
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.set('cache-control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
    headers.set('x-vr-seo', '1');
    return new Response(html, { status: 200, headers });
  } catch {
    return next();
  }
}
