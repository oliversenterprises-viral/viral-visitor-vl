/**
 * Refresh static public/ SEO fallbacks (Functions still rewrite origin at request time).
 * Run: npx vite-node scripts/write-public-seo.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildRobotsTxt,
  buildSitemapXml,
} from '../src/lib/organic-seo';

const pub = resolve(import.meta.dirname, '../public');
writeFileSync(resolve(pub, 'robots.txt'), buildRobotsTxt());
writeFileSync(resolve(pub, 'sitemap.xml'), buildSitemapXml());
writeFileSync(resolve(pub, 'llms.txt'), buildLlmsTxt());
writeFileSync(resolve(pub, 'llms-full.txt'), buildLlmsFullTxt());
console.log('wrote public robots.txt sitemap.xml llms.txt llms-full.txt');
