import https from 'https';

function get(url, opts = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, opts, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => resolve({ status: r.statusCode, headers: r.headers, body: d }));
    }).on('error', reject);
  });
}

const BASE = 'https://www.viralrefer.app';
const report = { timestamp: new Date().toISOString(), checks: {} };

// 1. Homepage
const home = await get(BASE + '/');
const html = home.body;
report.checks.homepageStatus = home.status;

// 2. Security headers
const csp = home.headers['content-security-policy'] || '';
report.checks.security = {
  csp: !!csp,
  redditInCsp: csp.includes('redditstatic.com'),
  supabaseInCsp: csp.includes('supabase.co'),
  hsts: !!(home.headers['strict-transport-security']),
  xFrameOptions: home.headers['x-frame-options'] === 'DENY',
  xContentType: home.headers['x-content-type-options'] === 'nosniff',
};

// 3. Public UI elements
report.checks.publicUi = {
  hero: html.includes('id="hero-title"') || html.includes('hero-title'),
  leaderboard: html.includes('leaderboard-container'),
  claimButton: html.includes('claimBanner()'),
  winnerModal: html.includes('id="winner-modal"'),
  singleWinnerModal: (html.match(/id="winner-modal"/g) || []).length === 1,
  submitPrizeClaim: html.includes('submitPrizeClaim'),
  turnstileContainer: html.includes('claim-turnstile-container'),
  demoHidden: html.includes('id="demo-referral-btn"') && html.includes('class="hidden'),
  noNocacheBuster: !html.includes('vr_owner_version') && !html.includes('?nocache='),
  noForceReloadBtn: !html.includes('Force load latest admin code'),
  prizeBannerVisual: html.includes('id="prize-banner-visual"'),
};

// 4. Reddit pixel
report.checks.reddit = {
  pixelScript: html.includes('redditstatic.com/ads/pixel.js'),
  pixelId: html.includes('a2_jr6jdbg2r4') || html.includes('VITE_REDDIT_PIXEL_ID'),
  rdtInit: html.includes("rdt('init'") || html.includes('rdt("init"'),
};

// 5. SEO / PWA
report.checks.seo = {
  title: html.includes('<title>'),
  ogTags: html.includes('og:title'),
  manifest: html.includes('manifest.json'),
  schema: html.includes('schema.org'),
};

// 6. Bundle analysis
const jsMatch = html.match(/assets\/index-[^"']+\.js/);
const cssMatch = html.match(/assets\/index-[^"']+\.css/);
let bundleSize = null;
if (jsMatch) {
  const js = await get(`${BASE}/${jsMatch[0]}`);
  bundleSize = js.body.length;
  report.checks.bundle = {
    mainJsKb: Math.round(js.body.length / 1024),
    hasSupabaseUrl: js.body.includes('wqbefjzpgsezzwdrvvua.supabase.co'),
    hasAdminActionSecret: /VITE_ADMIN_ACTION_SECRET|x-admin-secret/.test(js.body),
    hasHardcodedPassword: js.body.includes('nova2026') || js.body.includes('TestAdmin'),
  };
}

// 7. Supabase edge health (OPTIONS)
async function edgePing(name) {
  try {
    const r = await get(`https://wqbefjzpgsezzwdrvvua.supabase.co/functions/v1/${name}`, {
      method: 'OPTIONS',
      headers: { Origin: BASE },
    });
    return r.status;
  } catch (e) {
    return 'error';
  }
}
report.checks.edgeFunctions = {
  adminAction: await edgePing('admin-action'),
  submitClaim: await edgePing('submit-claim'),
  recordReferral: await edgePing('record-referral'),
  recordBannerEvent: await edgePing('record-banner-event'),
};

// 8. Supabase REST public read
try {
  const lb = await get('https://wqbefjzpgsezzwdrvvua.supabase.co/rest/v1/site_content?select=key&limit=1', {
    headers: {
      apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk',
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxYmVmanpwZ3Nlenp3ZHJ2dnVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NTMyNDAsImV4cCI6MjA4OTUyOTI0MH0.pVHqeG0sGPgpUlOlskf7rOvnAsdrzrv5govZXcyxEdk',
    },
  });
  report.checks.supabase = {
    siteContentStatus: lb.status,
    siteContentOk: lb.status === 200,
    siteContentError: lb.status !== 200 ? lb.body.slice(0, 200) : null,
  };
} catch (e) {
  report.checks.supabase = { error: String(e) };
}

console.log(JSON.stringify(report, null, 2));