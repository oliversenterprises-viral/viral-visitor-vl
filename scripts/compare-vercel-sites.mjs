#!/usr/bin/env node
/** Compare production URLs — same build or drift? */
import https from 'node:https';
import crypto from 'node:crypto';

const SITES = [
  { label: 'www.viralrefer.app (viralrefer-premium)', url: 'https://www.viralrefer.app' },
  { label: 'viralrefer.app apex', url: 'https://viralrefer.app' },
  { label: 'viral-visitor-vl.vercel.app (viralrefer project)', url: 'https://viral-visitor-vl.vercel.app' },
  { label: 'viralrefer-premium.vercel.app', url: 'https://viralrefer-premium.vercel.app' },
];

function get(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ...opts, headers: { 'User-Agent': 'NovaCompare/1.0', ...opts.headers } }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        const next = new URL(r.headers.location, url).href;
        return resolve(get(next, opts));
      }
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () =>
        resolve({
          status: r.statusCode,
          headers: r.headers,
          body: d,
          finalUrl: url,
        }),
      );
    });
    req.on('error', reject);
  });
}

function hash(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

for (const site of SITES) {
  try {
    const home = await get(site.url + '/');
    const jsPaths = [...new Set([...home.body.matchAll(/assets\/[^"']+\.js/g)].map((m) => m[0]))];
    const cssPaths = [...new Set([...home.body.matchAll(/assets\/[^"']+\.css/g)].map((m) => m[0]))];
    const mainJs = jsPaths.find((p) => p.includes('index-')) || jsPaths[0];
    let jsHash = '';
    if (mainJs) {
      const js = await get(site.url + '/' + mainJs);
      jsHash = hash(js.body);
    }
    console.log(`\n--- ${site.label} ---`);
    console.log('final:', home.finalUrl);
    console.log('status:', home.status);
    console.log('server:', home.headers.server);
    console.log('x-vercel-id:', home.headers['x-vercel-id'] || '—');
    console.log('main js:', mainJs || '—');
    console.log('js hash:', jsHash || '—');
    console.log('css files:', cssPaths.join(', ') || '—');
    console.log('html hash:', hash(home.body));
  } catch (e) {
    console.log(`\n--- ${site.label} --- ERROR:`, e.message);
  }
}