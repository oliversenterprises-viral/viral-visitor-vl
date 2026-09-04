import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { handleViralreferRequest, type AssetEnv } from '../../workers/viralrefer';
import { LOCKED_OG_TITLE } from '../../src/lib/prize-slot';

const deployScript = readFileSync(
  resolve(import.meta.dirname, '../../scripts/deploy-cloudflare.mjs'),
  'utf8',
);

function envWithAssets(body = '<html>spa</html>', status = 200): AssetEnv {
  return {
    ASSETS: {
      fetch: async () =>
        new Response(body, {
          status,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    },
  };
}

describe('Cloudflare Worker host', () => {
  it('sends social crawlers OG HTML on /r/CODE and keeps humans on the SPA', async () => {
    const env = envWithAssets();
    const bot = await handleViralreferRequest(
      new Request('https://example.com/r/VIRAL-TEST01', {
        headers: { 'user-agent': 'Twitterbot/1.0' },
      }),
      env,
    );
    const html = await bot.text();
    expect(bot.status).toBe(200);
    expect(html).toContain(LOCKED_OG_TITLE);
    expect(html).toContain('og:title');
    expect(html).toContain('VIRAL-TEST01');
    expect(html).not.toContain('<script>');

    const human = await handleViralreferRequest(
      new Request('https://example.com/r/VIRAL-TEST01', {
        headers: { 'user-agent': 'Mozilla/5.0 Chrome/120' },
      }),
      env,
    );
    expect(await human.text()).toBe('<html>spa</html>');
    expect(human.headers.get('X-Frame-Options')).toBe('DENY');
    expect(human.headers.get('Content-Security-Policy')).toContain('challenges.cloudflare.com');
  });

  it('rejects a bad referral code on OG routes', async () => {
    const env = envWithAssets();
    const res = await handleViralreferRequest(
      new Request('https://example.com/api/og-referral?code=nope'),
      env,
    );
    expect(res.status).toBe(400);
  });

  it('serves the SVG card without sharp', async () => {
    const env = envWithAssets();
    const res = await handleViralreferRequest(
      new Request('https://example.com/api/og-image?code=VIRAL-QRTEST'),
      env,
    );
    const svg = await res.text();
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(svg).toContain('<svg');
    expect(svg).toContain('VIRAL-QRTEST');
  });

  it('permanently redirects /relay to the traffic kit', async () => {
    const env = envWithAssets();
    const res = await handleViralreferRequest(
      new Request('https://example.com/relay'),
      env,
    );
    expect(res.status).toBe(301);
    expect(res.headers.get('Location')).toContain('/tools/traffic-refer-kit.html');
  });

  it('does not invoke assets for a bot /r/ so homepage spikes stay on the CDN', async () => {
    let assetHits = 0;
    const env: AssetEnv = {
      ASSETS: {
        fetch: async () => {
          assetHits += 1;
          return new Response('nope', { status: 500 });
        },
      },
    };
    const bot = await handleViralreferRequest(
      new Request('https://example.com/r/VIRAL-TEST01', {
        headers: { 'user-agent': 'facebookexternalhit/1.1' },
      }),
      env,
    );
    expect(bot.status).toBe(200);
    expect(assetHits).toBe(0);
  });
});

describe('Cloudflare deploy bakes public Supabase keys', () => {
  it('refuses to upload a Desk-dead build without VITE_SUPABASE_URL', () => {
    expect(deployScript).toContain('VITE_SUPABASE_URL');
    expect(deployScript).toContain('VITE_SUPABASE_ANON_KEY');
    expect(deployScript).toContain('VITE_TURNSTILE_SITEKEY');
    expect(deployScript).toContain('CLIENT_ENV_KEYS');
    expect(deployScript).toContain('Missing');
    expect(deployScript).toContain('.env.production.local');
    expect(deployScript).not.toMatch(/ADMIN_OWNER_PASSWORD/);
    expect(deployScript).not.toMatch(/ADMIN_ACTION_SECRET/);
    expect(deployScript).toContain('shell: true');
  });
});
