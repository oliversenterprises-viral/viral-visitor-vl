import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RACER_TALK_DEFAULT_TITLE,
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
  });

  it('keeps the in-repo source files the live bundle currently lacks', () => {
    expect(existsSync(resolve(root, 'src/lib/racer-talk.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'src/lib/racer-talk-parse.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'supabase/functions/racer-talk/index.ts'))).toBe(true);
    expect(existsSync(resolve(root, 'supabase/functions/_shared/racer-talk.ts'))).toBe(true);
    expect(read('src/lib/racer-talk.ts')).toContain('racer-talk');
    expect(read('src/lib/racer-talk.ts')).toContain(RACER_TALK_DEFAULT_TITLE);
    expect(read('src/lib/racer-talk.ts')).not.toMatch(/email required/i);
    expect(read('supabase/functions/racer-talk/index.ts')).toContain('email_required: false');
    expect(read('scripts/deploy-prod.mjs')).toMatch(/'racer-talk'/);
    expect(read('src/style.css')).not.toMatch(/\.racer-talk__title/);
    expect(read('src/lib/i18n/messages.ts')).not.toMatch(/racer-talk|racerTalk|RACER_TALK/);
  });

  it('homepage has the post-link message box and no email field', () => {
    const html = read('index.html');
    const admin = read('src/admin/edit-content-tab.ts');
    expect(html).toContain(`id="${RACER_TALK_ROOT_ID}"`);
    expect(html).toContain('class="vr-bc-title racer-talk__title"');
    expect(html).toContain(RACER_TALK_DEFAULT_TITLE);
    expect(html).not.toMatch(/id="racer-talk"[\s\S]{0,800}type="email"/);
    expect(read('src/content.ts')).toContain('applyRacerTalkFromContent');
    expect(read('src/lib/post-link-share.ts')).toContain('revealRacerTalk');
    expect(read('src/app.ts')).toContain('initRacerTalk');
    expect(admin).toContain('id="owner-broadcast-panel"');
    expect(admin).toContain('data-hq-talk="1"');
    expect(admin).toContain('data-racer-talk-tab="1"');
    expect(admin).toContain('Message box after Get my link');
    expect(admin).toContain('No email');
    expect(admin).not.toMatch(/type="email"/);
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
    expect(
      messageFromTalkContent({
        owner_broadcast_enabled: 'true',
        owner_broadcast_title: 'Rule update',
        owner_broadcast_body: 'You have about 2 days.',
      })?.title,
    ).toBe('Rule update');
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

  it('does not paint a site-wide banner on cold land', () => {
    document.body.innerHTML = `
      <div id="vr-owner-broadcast-banner"></div>
      <div id="referral-section">
        <div id="post-link-share"></div>
      </div>
    `;
    applyRacerTalkFromContent({
      owner_broadcast_enabled: '1',
      owner_broadcast_body: 'Send it.',
    });
    expect(document.getElementById('vr-owner-broadcast-banner')).toBeNull();
    expect(document.getElementById(RACER_TALK_ROOT_ID)?.hidden).toBe(true);
  });
});
