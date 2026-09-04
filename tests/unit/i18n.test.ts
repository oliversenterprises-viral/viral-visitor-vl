import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
import {
  detectBrowserLocale,
  normalizeLocale,
  t,
  applyI18n,
  setLocale,
  getLocale,
  isLocale,
  initI18n,
  SUPPORTED_LOCALES,
} from '../../src/lib/i18n';
import { MESSAGES } from '../../src/lib/i18n/messages';
import { EXTRA_LOCALES } from '../../src/lib/i18n/extra-locales';

describe('i18n phase 1', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-vr-locale');
    document.body.innerHTML = `
      <div class="vr-nav-links">
        <a data-i18n="nav.how">How</a>
        <button id="admin-btn">ADMIN</button>
      </div>
      <span id="hero-title-line1" data-i18n="hero.title_line1">Get your free link in 30 seconds.</span>
      <button id="hero-get-link-btn"><span data-i18n="hero.cta">Get my referral link</span></button>
    `;
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('dir');
  });

  it('normalizeLocale maps language tags', () => {
    expect(normalizeLocale('es-MX')).toBe('es');
    expect(normalizeLocale('pt-BR')).toBe('pt');
    expect(normalizeLocale('fr-CA')).toBe('fr');
    expect(normalizeLocale('de-DE')).toBe('de');
    expect(normalizeLocale('hi-IN')).toBe('hi');
    expect(normalizeLocale('zh-CN')).toBe('zh');
    expect(normalizeLocale('ja-JP')).toBe('ja');
    expect(normalizeLocale('ar-SA')).toBe('ar');
    expect(normalizeLocale('xx-ZZ')).toBe('en');
    expect(normalizeLocale('')).toBe('en');
  });

  it('detectBrowserLocale respects first preferred language', () => {
    expect(detectBrowserLocale({ languages: ['es-ES', 'en-US'] })).toBe('es');
    expect(detectBrowserLocale({ language: 'fr-FR' })).toBe('fr');
    expect(detectBrowserLocale({})).toBe('en');
  });

  it('t falls back to English for missing keys/locale', () => {
    expect(t('hero.cta', 'en')).toMatch(/get my referral link/i);
    expect(t('hero.cta_short', 'en')).toBe('Get my link');
    expect(t('hero.cta', 'es')).toMatch(/enlace/i);
    expect(isLocale('es')).toBe(true);
    expect(isLocale('xx')).toBe(false);
  });

  it('applyI18n paints Spanish into data-i18n nodes', () => {
    applyI18n('es');
    expect(document.documentElement.lang).toBe('es');
    expect(document.documentElement.getAttribute('data-vr-locale')).toBe('es');
    expect(document.querySelector('[data-i18n="nav.how"]')?.textContent).toBe('Cómo');
    expect(document.querySelector('[data-i18n="hero.cta"]')?.textContent).toMatch(/enlace/i);
  });

  it('Arabic sets document dir to rtl and English restores ltr', () => {
    applyI18n('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    applyI18n('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('setLocale persists and re-applies', () => {
    setLocale('pt');
    expect(getLocale()).toBe('pt');
    expect(localStorage.getItem('vr_locale')).toBe('pt');
    expect(document.querySelector('[data-i18n="hero.cta"]')?.textContent).toMatch(/indicação|link/i);
  });

  it('keeps 18 locales and never shrinks the picker to 6', () => {
    expect(EXTRA_LOCALES).toHaveLength(12);
    expect(SUPPORTED_LOCALES).toHaveLength(18);
    expect(new Set(SUPPORTED_LOCALES).size).toBe(18);
    for (const loc of ['en', 'es', 'fr', 'pt', 'de', 'hi', ...EXTRA_LOCALES]) {
      expect(isLocale(loc)).toBe(true);
    }
  });

  it('sets leaderboard.title to Recent Activity in every locale', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const title = MESSAGES[locale]['leaderboard.title'];
      expect(title).toBeTruthy();
      expect(title).not.toMatch(/early leaderboard/i);
      expect(title).not.toMatch(/this week's race/i);
      expect(title).not.toMatch(/live leaderboard/i);
    }
    expect(MESSAGES.en['leaderboard.title']).toBe('Recent Activity');
    expect(t('leaderboard.title', 'en')).toBe('Recent Activity');
  });

  it('sets hero.badge to THIS WEEK in English', () => {
    expect(MESSAGES.en['hero.badge']).toBe('THIS WEEK • FREE • NO SIGNUP');
    expect(t('hero.badge', 'en')).toMatch(/this week/i);
    expect(t('hero.badge', 'en')).not.toMatch(/worldwide/i);
  });

  it('keeps Site Drop English on the hero, not banner-only copy', () => {
    expect(MESSAGES.en['hero.title_accent']).toMatch(/each step puts your site/i);
    expect(MESSAGES.en['hero.title_accent']).not.toMatch(/gets a banner for their site/i);
    expect(MESSAGES.en['hero.subtitle']).toMatch(/rising drop/i);
    expect(MESSAGES.en['hero.trust']).toMatch(/7-day banner/i);
    expect(MESSAGES.en['hero.trust']).not.toMatch(/30-day/i);
    expect(MESSAGES.en['prize.subtitle']).toMatch(/7-day banner/i);
    expect(MESSAGES.en['prize.subtitle']).not.toMatch(/30-day/i);
    expect(MESSAGES.en['how.step3_desc']).toMatch(/rising site drop/i);
    expect(MESSAGES.en['how.step3_desc']).not.toMatch(/30 days/i);
    expect(MESSAGES.en['share.default']).toMatch(/site drops/i);
    expect(MESSAGES.en['share.default']).not.toMatch(/gets a banner for their site/i);
    expect(MESSAGES.en['share.default']).toMatch(/Tap Get my link/);
    expect(MESSAGES.en['share.default']).toMatch(/Visiting does not count/);
    expect(MESSAGES.es['share.default']).toMatch(/Obtener mi enlace/);
    expect(MESSAGES.es['share.default']).toMatch(/Visitar no cuenta/);
    expect(MESSAGES.fr['share.default']).toMatch(/Obtenir mon lien/);
    expect(MESSAGES.en['footer.tools']).toBe('Tools');
    expect(MESSAGES.es['footer.privacy']).toMatch(/Privacidad/);
    expect(MESSAGES.es['deadline.pending']).toMatch(/Obtener mi enlace/);
    expect(MESSAGES.es['send_mode.sub']).toMatch(/Obtener mi enlace/);
    expect(MESSAGES.es['share_abandon.title']).toMatch(/enviarlo/i);
    expect(MESSAGES.fr['deadline.locked']).toMatch(/Bloqué/);
    expect(MESSAGES.ar['deadline.pending']).not.toBe(MESSAGES.en['deadline.pending']);
    expect(MESSAGES.ja['send_mode.primary_cta']).not.toBe(MESSAGES.en['send_mode.primary_cta']);
    expect(MESSAGES.it['exit.cta']).not.toBe(MESSAGES.en['exit.cta']);
    expect(MESSAGES.fr['proof.live_default']).not.toBe(MESSAGES.en['proof.live_default']);
    expect(MESSAGES.es['share_first.heading']).toMatch(/Envía tu enlace/);
    expect(MESSAGES.ar['proof.fomo_empty']).not.toBe(MESSAGES.en['proof.fomo_empty']);
    expect(MESSAGES.ja['share_first.cta_whatsapp']).not.toBe(MESSAGES.en['share_first.cta_whatsapp']);
    expect(MESSAGES.de['rule.public']).toMatch(/Meinen Link holen/);
    expect(MESSAGES.es['share_first.fomo']).toMatch(/primeros puestos/i);
    expect(MESSAGES.es['proof.verified_live_n']).toMatch(/referidos verificados/);
    expect(MESSAGES.es['proof.leader_has_n']).toMatch(/#1/);
    expect(MESSAGES.ar['proof.credits_only']).not.toBe(MESSAGES.en['proof.credits_only']);
    expect(MESSAGES.en['funnel.guide_2']).toMatch(/Send it to a friend/i);
    expect(MESSAGES.en['funnel.guide_2']).not.toMatch(/copy → share/i);
    expect(MESSAGES.es['coach.status_2']).toMatch(/Envía tu enlace/);
    expect(MESSAGES.ja['funnel.guide_2']).not.toBe(MESSAGES.en['funnel.guide_2']);
    expect(MESSAGES.es['ticker.live']).toMatch(/EN VIVO/i);
    expect(MESSAGES.ar['growth.credit_sub']).not.toBe(MESSAGES.en['growth.credit_sub']);
    expect(MESSAGES.es['duel.headline']).toMatch(/Reta a un amigo/);
    expect(MESSAGES.en['challenge.badge']).toMatch(/DUEL MODE/);
    expect(MESSAGES.ja['duel.headline']).not.toBe(MESSAGES.en['duel.headline']);
    expect(MESSAGES.en['funnel.badge']).toBe('SITE DROP LADDER');
    expect(MESSAGES.en['how.badge']).toBe('SITE DROP LADDER');
    expect(MESSAGES.en['how.step1_desc']).toMatch(/just entered/i);
    expect(MESSAGES.en['drop.entered_short']).toBe('Just entered');
    expect(MESSAGES.en['drop.rung_open']).toBe('open');
    expect(MESSAGES.en['post_link.heading']).toBe("You're racing.");
    expect(MESSAGES.en['post_link.send']).toBe('Send it now');
    expect(MESSAGES.es['post_link.heading']).toMatch(/carrera/i);
    expect(MESSAGES.es['post_link.send']).toMatch(/Envíalo/i);
    expect(MESSAGES.fr['post_link.heading']).toMatch(/course/i);
    expect(MESSAGES.fr['post_link.send']).toMatch(/Envoyez/i);
    expect(MESSAGES.pt['post_link.heading']).toMatch(/corrida/i);
    expect(MESSAGES.de['post_link.send']).toMatch(/senden/i);
    expect(MESSAGES.hi['post_link.copy']).toMatch(/कॉपी/i);
    expect(MESSAGES.it['post_link.send']).toMatch(/Invialo/i);
    expect(MESSAGES.ar['post_link.heading']).toMatch(/السباق/);
    expect(MESSAGES.zh['post_link.copy']).toMatch(/复制/);
    expect(MESSAGES.ja['post_link.send']).toMatch(/送る/);
    expect(MESSAGES.ru['post_link.heading']).toMatch(/гонке/);
    expect(MESSAGES.en['funnel.expand']).toBe('See how it works');
    expect(MESSAGES.es['funnel.expand']).toMatch(/cómo funciona/i);
    expect(MESSAGES.fr['funnel.expand']).toMatch(/comment/i);
    expect(MESSAGES.es['drop.rung_open']).toBe('abierto');
    expect(MESSAGES.es['prize.card3_desc']).toMatch(/3 amigos/);
    expect(MESSAGES.es['prize.card3_desc']).not.toMatch(/altas únicas/);
    expect(MESSAGES.fr['prize.card3_desc']).not.toMatch(/Inscriptions uniques/);
    expect(MESSAGES.en['coach.chrome_sub']).toMatch(/Get my link/i);
    expect(MESSAGES.en['coach.chrome_sub']).not.toMatch(/copy\s*→\s*share/i);
    expect(MESSAGES.es['faq.q1']).toMatch(/enlace/i);
    expect(MESSAGES.es['faq.a4']).toMatch(/Obtener mi enlace/);
    expect(MESSAGES.fr['faq.a4']).toMatch(/Obtenir mon lien/);
    expect(MESSAGES.ar['faq.q1']).not.toBe(MESSAGES.en['faq.q1']);
    expect(MESSAGES.ja['faq.a4']).not.toBe(MESSAGES.en['faq.a4']);
    expect(MESSAGES.it['drop.title']).not.toBe(MESSAGES.en['drop.title']);
    for (const loc of EXTRA_LOCALES) {
      expect(MESSAGES[loc]['post_link.heading']).not.toBe("You're racing.");
      expect(MESSAGES[loc]['post_link.send']).not.toBe('Send it now');
      expect(MESSAGES[loc]['post_link.copy']).not.toBe('Copy link');
      expect(MESSAGES[loc]['hero.cta']).not.toBe('Get my referral link');
      expect(MESSAGES[loc]['hero.title_line1']).not.toBe('Win the homepage.');
      expect(MESSAGES[loc]['funnel.expand']).not.toBe('See how it works');
      expect(MESSAGES[loc]['how.step2_desc']).not.toBe(MESSAGES.en['how.step2_desc']);
      expect(MESSAGES[loc]['share.default']).not.toBe(MESSAGES.en['share.default']);
      expect(MESSAGES[loc]['footer.privacy']).not.toBe(MESSAGES.en['footer.privacy']);
      expect(MESSAGES[loc]['proof.live_default']).not.toBe(MESSAGES.en['proof.live_default']);
      expect(MESSAGES[loc]['share_first.heading']).not.toBe(MESSAGES.en['share_first.heading']);
    }
    expect(MESSAGES.en['drop.lead']).toMatch(/7-day banner/);
    expect(MESSAGES.en['drop.lead']).not.toMatch(/30-day/i);
  });

  it('no locale says a visit counts or uses the old 3-step ladder', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const how2 = MESSAGES[locale]['how.step2_desc'];
      const badge = `${MESSAGES[locale]['how.badge']} ${MESSAGES[locale]['funnel.badge']}`;
      const step2 = MESSAGES[locale]['funnel.step2'];
      expect(how2).not.toMatch(/visita puede contar|visite peut compter|visita pode contar|Besuch kann zählen|विज़िट गिन/i);
      expect(badge).not.toMatch(/3 EASY STEPS|3 PASOS SIMPLES|3 ÉTAPES SIMPLES|3 PASSOS SIMPLES|3 EINFACHE SCHRITTE|3 आसान स्टेप/i);
      expect(step2).not.toMatch(/^2\.\s*(Copiar|Copier|Kopieren|कॉपी)\b/);
      expect(MESSAGES[locale]['how.step3_desc']).not.toMatch(/30-day|30 days/i);
      expect(MESSAGES[locale]['faq.a4']).not.toMatch(
        /visita puede contar|visite peut compter|visita pode contar|Besuch kann zählen|विज़िट गिन/i,
      );
      expect(MESSAGES[locale]['coach.chrome_sub']).not.toMatch(/copy\s*→\s*share|copiar\s*→\s*compartir/i);
      expect(MESSAGES[locale]['share.default']).toContain('{link}');
      expect(MESSAGES[locale]['share.default']).toMatch(/site drops/i);
      expect(MESSAGES[locale]['share.default']).not.toMatch(
        /visita puede contar|visite peut compter|visita pode contar|Besuch kann zählen|विज़िट गिन/i,
      );
      expect(MESSAGES[locale]['deadline.pre_rule']).not.toMatch(
        /visita puede contar|visite peut compter|visita pode contar|Besuch kann zählen|विज़िट गिन/i,
      );
      expect(MESSAGES[locale]['deadline.pending']).not.toBe('');
      expect(MESSAGES[locale]['send_mode.sub']).not.toMatch(/copy → share/i);
    }
    expect(MESSAGES.es['how.step2_desc']).toMatch(/Obtener mi enlace/);
    expect(MESSAGES.es['funnel.step2']).toMatch(/Envíalo/);
    expect(MESSAGES.fr['how.step2_desc']).toMatch(/Obtenir mon lien/);
    expect(MESSAGES.pt['how.step2_desc']).toMatch(/Pegar meu link/);
    expect(MESSAGES.de['how.step2_desc']).toMatch(/Meinen Link holen/);
  });

  it('coach never treats copy or a visit as the scoring step', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const blob = [
        MESSAGES[locale]['coach.greet_direct'],
        MESSAGES[locale]['coach.greet_referred'],
        MESSAGES[locale]['coach.prize_reply'],
        MESSAGES[locale]['coach.free_reply'],
        MESSAGES[locale]['coach.fallback'],
        MESSAGES[locale]['coach.chrome_sub'],
        MESSAGES[locale]['coach.greet_complete'],
      ].join(' ');
      expect(blob).not.toMatch(/enlace → copiar → compartir/i);
      expect(blob).not.toMatch(/cópialo y comparte/i);
      expect(blob).not.toMatch(/pregunta por el enlace, copiar, compartir/i);
    }
    expect(MESSAGES.en['coach.prize_reply']).toMatch(/7-day banner/i);
    expect(MESSAGES.en['coach.fallback']).toMatch(/Get my link/i);
    expect(MESSAGES.es['coach.greet_referred']).toMatch(/envíalo/i);
    const coachSrc = readFileSync(resolve(ROOT, 'src/lib/funnel-coach-chat.ts'), 'utf8');
    expect(coachSrc).not.toMatch(/copy\s*→\s*share/i);
    expect(coachSrc).toContain('coach.chrome_sub');
    expect(MESSAGES.es['coach.prize_reply']).toMatch(/7 días/i);
  });

  it('wires #vr-lang-select with all 18 options', () => {
    initI18n();
    const select = document.getElementById('vr-lang-select') as HTMLSelectElement | null;
    expect(select).toBeTruthy();
    expect(select?.options.length).toBe(18);
    const values = [...(select?.options ?? [])].map((opt) => opt.value);
    expect(values).toEqual([...SUPPORTED_LOCALES]);
  });

  it('paints Recent Activity onto #leaderboard-title', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<h2 id="leaderboard-title" data-i18n="leaderboard.title">This week\'s race</h2>',
    );
    applyI18n('en');
    expect(document.getElementById('leaderboard-title')?.textContent).toBe('Recent Activity');
  });
});

describe('owner Site Drops i18n HTML lock', () => {
  it('first-paint ladder title and hero badge match the 18-locale dictionary', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/id="leaderboard-title"[^>]*>Recent Activity</);
    expect(html).toMatch(/data-i18n="leaderboard.title"/);
    expect(html).not.toMatch(/id="leaderboard-title"[^>]*>Early Leaderboard</);
    expect(html).not.toMatch(/id="leaderboard-title"[^>]*>This week's race</);
    expect(html).toMatch(/data-i18n="hero.badge"/);
    expect(html).toMatch(/THIS WEEK &bull; FREE &bull; NO SIGNUP/);
    expect(html).toContain('Your site here');
  });
});
