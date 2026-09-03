import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildRacerTalkPanelHTML } from '../../src/admin/racer-talk-tab';
import {
  RACER_TALK_DEFAULT_TITLE,
  RACER_TALK_FETCH_TIMEOUT_MS,
  RACER_TALK_ROOT_ID,
  applyRacerTalkFromContent,
  hideRacerTalk,
  messageFromTalkContent,
  parseRacerTalkMessage,
  revealRacerTalk,
  visitorMaySeeRacerTalk,
} from '../../src/lib/racer-talk';

const root = resolve(import.meta.dirname, '../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('racer-talk (Message from ViralRefer after Get my link)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute('data-vr-post-link-one');
    delete document.documentElement.dataset.racerTalkBound;
    delete document.documentElement.dataset.racerTalkHydrate;
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps the in-repo source files the live bundle currently lacks', () => {
    expect(existsSync(resolve(root, 'src/lib/racer-talk.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'src/admin/racer-talk-tab.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'supabase/functions/racer-talk/index.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'supabase/functions/_shared/racer-talk.ts'))).toBe(true);
    expect(read('src/lib/racer-talk.ts')).toContain('racer-talk');
    expect(read('src/lib/racer-talk.ts')).toContain(RACER_TALK_DEFAULT_TITLE);
    expect(read('src/lib/racer-talk.ts')).not.toMatch(/email required/i);
    expect(read('src/lib/racer-talk.ts')).not.toMatch(/functions\.invoke\(/);
    expect(read('src/lib/racer-talk.ts')).not.toMatch(/from '\.\/supabase'/);
    expect(read('src/lib/racer-talk.ts')).toContain('RACER_TALK_FETCH_TIMEOUT_MS = 2_000');
    expect(read('src/lib/racer-talk.ts')).toContain('AbortController');
    expect(read('src/lib/racer-talk.ts')).toContain('/functions/v1/racer-talk');
    expect(read('src/lib/racer-talk.ts')).not.toMatch(/Ping after Get my link/);
    expect(RACER_TALK_FETCH_TIMEOUT_MS).toBe(2_000);
    expect(read('supabase/functions/racer-talk/index.ts')).toContain('email_required: false');
    expect(read('scripts/deploy-prod.mjs')).toMatch(/'racer-talk'/);
  });

  it('homepage has the post-link message box and no email field', () => {
    const html = read('index.html');
    const css = read('src/style.css');
    expect(html).toContain(`id="${RACER_TALK_ROOT_ID}"`);
    expect(html).toContain('id="racer-talk-form"');
    expect(html).toContain('id="racer-ping"');
    expect(html).toContain('class="racer-talk__title"');
    expect(html).toContain(RACER_TALK_DEFAULT_TITLE);
    expect(html).toContain('Site Drop &middot; Just entered');
    expect(html).toContain('Site Drop');
    expect(html).not.toMatch(/Ping after Get my link/);
    expect(html).not.toMatch(/Racer ping/);
    expect(html).toMatch(/id="racer-ping"[^>]*hidden/);
    expect(html).not.toMatch(/id="racer-talk"[\s\S]{0,800}type="email"/);
    expect(html).not.toMatch(/id="racer-talk-form"[\s\S]{0,400}type="email"/);
    expect(css).toMatch(/\.racer-talk__title[\s\S]*color:\s*#f4f4f5/);
    expect(css).toMatch(/html\[data-vr-has-link\] \.racer-talk\[data-talk-ready='1'\]/);
    expect(read('src/content.ts')).toContain('applyRacerTalkFromContent');
    expect(read('src/lib/post-link-share.ts')).toContain('revealRacerTalk');
    expect(read('src/app.ts')).toContain('initRacerTalk');
    expect(read('public/google163d31ba24216edd.html')).toContain(
      'google-site-verification: google163d31ba24216edd.html',
    );
  });

  it('parses Talk CMS keys and defaults the title', () => {
    expect(parseRacerTalkMessage(null)).toBeNull();
    expect(
      parseRacerTalkMessage({
        owner_broadcast_enabled: '0',
        owner_broadcast_body: 'Hello',
      }),
    ).toBeNull();
    const msg = parseRacerTalkMessage({
      owner_broadcast_enabled: '1',
      owner_broadcast_body: 'A friend must tap Get my link.',
    });
    expect(msg).not.toBeNull();
    expect(msg!.title).toBe(RACER_TALK_DEFAULT_TITLE);
    expect(msg!.emailRequired).toBe(false);
    expect(msg!.body).toContain('Get my link');
    expect(messageFromTalkContent({
      owner_broadcast_enabled: 'true',
      owner_broadcast_title: 'Rule update',
      owner_broadcast_body: 'You have about 2 days.',
    })?.title).toBe('Rule update');
  });

  it('stays hidden until Get my link, then reveals the painted panel', () => {
    document.body.innerHTML = `
      <div id="referral-section">
        <div id="post-link-share"></div>
      </div>
    `;
    applyRacerTalkFromContent({
      owner_broadcast_enabled: '1',
      owner_broadcast_title: RACER_TALK_DEFAULT_TITLE,
      owner_broadcast_body: 'Send it. A friend must tap Get my link.',
    });
    const panel = document.getElementById(RACER_TALK_ROOT_ID);
    expect(panel).toBeTruthy();
    expect(panel!.dataset.talkReady).toBe('1');
    expect(panel!.hidden).toBe(true);
    expect(visitorMaySeeRacerTalk()).toBe(false);

    document.documentElement.setAttribute('data-vr-has-link', '1');
    revealRacerTalk();
    expect(panel!.hidden).toBe(false);
    expect(panel!.querySelector('.racer-talk__title')?.textContent).toBe(RACER_TALK_DEFAULT_TITLE);
    expect(panel!.querySelector('#racer-talk-body')?.textContent).toContain('Get my link');

    hideRacerTalk();
    expect(panel!.hidden).toBe(true);
  });

  it('admin Talk panel stays on Website and says no email', () => {
    const html = buildRacerTalkPanelHTML({
      enabled: false,
      title: '',
      body: '',
      id: '',
      mediaUrl: '',
      sponsorLabel: '',
      sponsorUrl: '',
      sponsorImage: '',
      sponsorCta: '',
    });
    expect(html).toContain('id="owner-broadcast-panel"');
    expect(html).toContain('data-hq-talk="1"');
    expect(html).toContain('data-racer-talk-tab="1"');
    expect(html).toContain('data-hq-talk-idle="1"');
    expect(html).toContain('Message box after Get my link');
    expect(html).toContain('No email');
    expect(html).not.toMatch(/type="email"/);
  });

  it('times out Talk fetch at 2s and never uses functions.invoke', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();

    const invoke = vi.fn(() => new Promise(() => {}));
    vi.doMock('../../src/lib/supabase', () => ({
      isSupabaseConfigured: true,
      supabase: { functions: { invoke } },
    }));

    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      }),
    );

    const { fetchRacerTalkFromEdge, RACER_TALK_FETCH_TIMEOUT_MS: timeoutMs } = await import(
      '../../src/lib/racer-talk'
    );
    expect(timeoutMs).toBe(2_000);
    vi.useFakeTimers();
    const pending = fetchRacerTalkFromEdge();
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await pending;
    vi.useRealTimers();
    expect(result).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('does not hydrate Talk from the edge on cold land', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    document.body.innerHTML = `
      <div id="referral-section">
        <div id="post-link-share"></div>
      </div>
    `;
    const { initRacerTalk } = await import('../../src/lib/racer-talk');
    initRacerTalk();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(visitorMaySeeRacerTalk()).toBe(false);
  });

  it('hydrates Talk from GET /functions/v1/racer-talk only after Get my link', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.resetModules();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        enabled: true,
        email_required: false,
        message: {
          enabled: true,
          title: 'Message from ViralRefer',
          body: 'Send it. A friend must tap Get my link.',
          id: 'after-link',
          mediaUrl: null,
          sponsor: null,
          emailRequired: false,
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    document.body.innerHTML = `
      <div id="referral-section">
        <div id="post-link-share"></div>
      </div>
    `;
    const { initRacerTalk } = await import('../../src/lib/racer-talk');
    initRacerTalk();
    expect(fetchMock).not.toHaveBeenCalled();

    document.documentElement.setAttribute('data-vr-has-link', '1');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/functions/v1/racer-talk');
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer anon-key');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
