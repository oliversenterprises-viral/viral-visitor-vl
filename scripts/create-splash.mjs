#!/usr/bin/env node
/**
 * Create a high-conversion ViralRefer splash / landing page under public/go/<slug>/
 *
 * Usage:
 *   node scripts/create-splash.mjs <slug> [options]
 *   npm run splash:create -- makers --preset makers --force
 *   npm run splash:list
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'marketing', 'splash-pages', 'template', 'index.html');
const OUT_GO = path.join(ROOT, 'public', 'go');
const OUT_EMBED = path.join(ROOT, 'public', 'embed');

const PRESETS = {
  makers: {
    PAGE_TITLE: 'Get free homepage visibility for your site · ViralRefer',
    META_DESCRIPTION:
      'Free worldwide referral leaderboard for makers. Get a link in 30s — no email. Climb to #1 and claim a homepage banner for your website. No cash prize.',
    BADGE: 'Built for makers & solopreneurs',
    HEADLINE: 'Turn shares into <em>real homepage traffic</em>',
    SUBHEAD:
      'Get a free trackable link in ~30 seconds. When friends join through you, you climb a live board. #1 can feature their website on ViralRefer.',
    CARD_LABEL: 'The prize (not cash)',
    CARD_TITLE: 'Homepage banner for your site',
    PRIZE_BLURB:
      'Pure visibility. No payment, no email wall — just climb with verified referrals and claim the #1 feature slot.',
    BULLET_1: 'Your site + banner on viralrefer.app after verification',
    BULLET_2: 'No cash prize — free recognition & social proof',
    BULLET_3: 'Early ranks are still open — easier to climb now',
    CTA_LABEL: 'Get my free link now',
    FINE_PRINT: 'Free · No email · 18+ worldwide',
    URGENCY: 'Early ranks open — claim your spot before the board fills',
    YOU_LINE: 'One tap → your free link',
    BOARD_FOOT: 'You are not on the board yet. <strong>First verified friends unlock your rank.</strong>',
    MID_HOOK: 'Your site deserves eyes — not another paywall.',
    MID_SUB: 'Join free, share your link, race for the homepage feature.',
    FAQ3_Q: 'Why would this help my project?',
    FAQ3_A:
      'If you climb to #1, your website can appear as a featured partner on ViralRefer’s homepage — free brand exposure to people already interested in viral sharing and growth.',
    STICKY_TITLE: 'Feature your site',
    STICKY_SUB: 'Free link · ~30 seconds',
    UTM_SOURCE: 'splash',
    UTM_MEDIUM: 'landing',
    UTM_CAMPAIGN: 'makers',
  },
  race: {
    PAGE_TITLE: 'Free no-signup referral race · Climb live · ViralRefer',
    META_DESCRIPTION:
      'No email. No signup wall. Get a free referral link in 30 seconds and climb a live worldwide leaderboard. #1 claims homepage feature.',
    BADGE: 'Live worldwide · free forever',
    HEADLINE: 'No signup. Free link. <em>Climb live.</em>',
    SUBHEAD:
      'The simplest viral race on the web: tap once, share anywhere, watch real ranks move when friends actually get their own free link.',
    CARD_LABEL: 'Why this converts',
    CARD_TITLE: 'Zero friction → pure competition',
    PRIZE_BLURB:
      'Most “referral contests” bury you in forms. ViralRefer skips the wall so sharing starts in under a minute.',
    BULLET_1: 'No email · no password · link in ~30 seconds',
    BULLET_2: 'Only verified “get link” actions count (bots blocked)',
    BULLET_3: '#1 claims a homepage feature for their website',
    CTA_LABEL: 'Start the race — free',
    FINE_PRINT: 'Open worldwide · 18+ · No purchase needed',
    URGENCY: 'LIVE race — early ranks are still wide open',
    YOU_LINE: 'Tap to enter the race',
    BOARD_FOOT: 'Ranks update from <strong>verified referrals only</strong> — not fake clicks.',
    MID_HOOK: 'Copying is not enough. Sharing wins.',
    MID_SUB: 'A friend must open your link and get their free link. That’s the whole game.',
    FAQ3_Q: 'How fast can I start?',
    FAQ3_A:
      'About 30 seconds. Tap Get my referral link on the main app, copy your unique URL, then share on WhatsApp, X, SMS, Reddit, Discord, or anywhere.',
    STICKY_TITLE: 'Join the free race',
    STICKY_SUB: 'No email · live ranks',
    UTM_SOURCE: 'splash',
    UTM_MEDIUM: 'landing',
    UTM_CAMPAIGN: 'race',
  },
  feature: {
    PAGE_TITLE: 'Race for #1 · Homepage feature for your website · ViralRefer',
    META_DESCRIPTION:
      'Climb ViralRefer’s free leaderboard. #1 can claim a homepage banner feature for their website. No cash prize. Free · no signup · 18+.',
    BADGE: 'Homepage feature campaign',
    HEADLINE: 'Race for <em>#1</em> — put your site on our homepage',
    SUBHEAD:
      'Not a cash giveaway. A public visibility prize: the top verified referrer can claim a homepage banner slot for their website.',
    CARD_LABEL: 'What #1 can claim',
    CARD_TITLE: 'Homepage banner feature',
    PRIZE_BLURB:
      'After verification and meeting the minimum on-site threshold, #1 submits their site for the featured partner banner.',
    BULLET_1: 'Featured on viralrefer.app — free recognition',
    BULLET_2: 'No purchase necessary · no cash prize',
    BULLET_3: 'Share WhatsApp, X, SMS, Reddit, Discord…',
    CTA_LABEL: 'I want the homepage feature',
    FINE_PRINT: 'Skill / effort based · verified only',
    URGENCY: '#1 slot is claimable — board is still early',
    YOU_LINE: 'Start from zero — climb with shares',
    BOARD_FOOT: '<strong>Only #1</strong> claims the banner — every referral moves the gap.',
    MID_HOOK: 'Visibility beats vanity metrics.',
    MID_SUB: 'Get your free link and start closing the gap to #1 today.',
    FAQ3_Q: 'Is there a cash prize?',
    FAQ3_A:
      'No. ViralRefer does not pay cash prizes. The reward for #1 is a homepage banner feature for their website after verification. Always check the live site for current rules.',
    STICKY_TITLE: 'Claim #1 visibility',
    STICKY_SUB: 'Homepage banner · free to enter',
    UTM_SOURCE: 'splash',
    UTM_MEDIUM: 'landing',
    UTM_CAMPAIGN: 'homepage_feature',
  },
  challenge: {
    PAGE_TITLE: 'Challenge a friend · Free referral duel · ViralRefer',
    META_DESCRIPTION:
      'Challenge a friend on ViralRefer. Both get free links, share, and climb. Highest verified referrals win bragging rights — #1 can claim homepage feature.',
    BADGE: 'Rivalry mode · free for both',
    HEADLINE: 'Challenge a friend. <em>Outrank them.</em>',
    SUBHEAD:
      'Send the race. Both get free links. Whoever brings more verified friends climbs higher. Winner energy — homepage feature for global #1.',
    CARD_LABEL: 'The duel',
    CARD_TITLE: 'Friendly competition, real ranks',
    PRIZE_BLURB:
      'Rivalry is the strongest share loop. One message, two competitors, one live board.',
    BULLET_1: 'You both start free in ~30 seconds',
    BULLET_2: 'Only friends who get their own free link count',
    BULLET_3: 'Climb the same worldwide board — no private leagues needed',
    CTA_LABEL: 'Get my link & start the duel',
    FINE_PRINT: 'Free for both of you · 18+',
    URGENCY: 'Pick a rival before they pick you',
    YOU_LINE: 'You vs them — start now',
    BOARD_FOOT: 'First verified referral unlocks your rank. <strong>Don’t show up last.</strong>',
    MID_HOOK: 'Text them one line: “Beat my rank.”',
    MID_SUB: 'Get your link first so every friend you send is already on your chain.',
    FAQ3_Q: 'How do I challenge someone?',
    FAQ3_A:
      'Get your free link, then share it with a competitive message (WhatsApp works best). They should also get their own link and share to their network. Compare ranks on the live leaderboard.',
    STICKY_TITLE: 'Start the duel',
    STICKY_SUB: 'Free link · challenge mode',
    UTM_SOURCE: 'splash',
    UTM_MEDIUM: 'landing',
    UTM_CAMPAIGN: 'challenge',
  },
  blank: {
    PAGE_TITLE: 'ViralRefer · Free worldwide referral leaderboard',
    META_DESCRIPTION:
      'Get your free referral link in 30 seconds — no signup. Climb the live leaderboard. #1 can claim a homepage feature. No cash prizes.',
    BADGE: 'Worldwide · free · no signup',
    HEADLINE: 'Get your free link. <em>Climb the board.</em>',
    SUBHEAD:
      'Share your unique link. When friends get their own free link through you, you climb. #1 can claim a homepage feature for their website.',
    CARD_LABEL: 'How you win',
    CARD_TITLE: 'Homepage feature · no cash prize',
    PRIZE_BLURB: 'Free forever. Verified referrals only. Transparent leaderboard.',
    BULLET_1: 'Free forever · no email required',
    BULLET_2: 'Live leaderboard · verified referrals only',
    BULLET_3: 'Open worldwide · 18+',
    CTA_LABEL: 'Get my referral link',
    FINE_PRINT: 'Free · No email · 18+',
    URGENCY: 'Live leaderboard — early ranks still open',
    YOU_LINE: 'Your rank starts after you share',
    BOARD_FOOT: '<strong>Verified only</strong> — no bots, no fake traffic.',
    MID_HOOK: 'Ready in 30 seconds.',
    MID_SUB: 'Tap below, get your link, start climbing.',
    FAQ3_Q: 'What do I win?',
    FAQ3_A:
      '#1 can claim a homepage banner feature for their website. There is no cash prize. Full rules are on viralrefer.app.',
    STICKY_TITLE: 'Get your free link',
    STICKY_SUB: 'No email · ~30 seconds',
    UTM_SOURCE: 'splash',
    UTM_MEDIUM: 'landing',
    UTM_CAMPAIGN: 'organic',
  },
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--list') args.list = true;
    else if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    } else args._.push(a);
  }
  return args;
}

function slugify(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function listPages() {
  if (!fs.existsSync(OUT_GO)) {
    console.log('No splash pages yet. Create one with: npm run splash:create -- <slug>');
    return;
  }
  const dirs = fs
    .readdirSync(OUT_GO, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  if (!dirs.length) {
    console.log('No splash pages yet.');
    return;
  }
  console.log('Dual-mode splash pages (pick on the fly):\n');
  console.log('  FULL PAGE (iframe blocked — social / ads / posts)');
  console.log('  IFRAME OK  (traffic exchanges that embed your site)\n');
  for (const d of dirs) {
    console.log(`  ${d}`);
    console.log(`    full:   https://www.viralrefer.app/go/${d}/`);
    console.log(`    iframe: https://www.viralrefer.app/embed/${d}/`);
  }
  console.log('');
}

function fill(template, map) {
  let out = template;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{{${k}}}`).join(String(v));
  }
  const leftover = out.match(/\{\{[A-Z0-9_]+\}\}/g);
  if (leftover?.length) {
    console.warn('Warning: unreplaced tokens:', [...new Set(leftover)].join(', '));
  }
  return out;
}

function j(s) {
  return JSON.stringify(String(s));
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    listPages();
    return;
  }

  const slugRaw = args._[0];
  if (!slugRaw) {
    console.log(`ViralRefer dual-mode splash factory

Creates BOTH URLs for every slug:
  Full page (no iframe):  /go/<slug>/
  Iframe OK (exchanges):  /embed/<slug>/

Usage:
  npm run splash:create -- <slug> [--preset makers|race|feature|challenge|blank] [--force]
  npm run splash:list

Examples:
  npm run splash:create -- makers --preset makers --force
  npm run splash:create -- reddit-week1 --preset race --utm-source reddit --utm-campaign week1
`);
    process.exit(0);
  }

  const slug = slugify(slugRaw);
  if (!slug) {
    console.error('Invalid slug.');
    process.exit(1);
  }

  const presetName = typeof args.preset === 'string' ? args.preset : 'blank';
  const preset = PRESETS[presetName];
  if (!preset) {
    console.error(`Unknown preset "${presetName}". Use: ${Object.keys(PRESETS).join(', ')}`);
    process.exit(1);
  }

  if (!fs.existsSync(TEMPLATE)) {
    console.error('Template missing:', TEMPLATE);
    process.exit(1);
  }

  const goFile = path.join(OUT_GO, slug, 'index.html');
  const embedFile = path.join(OUT_EMBED, slug, 'index.html');
  if ((fs.existsSync(goFile) || fs.existsSync(embedFile)) && !args.force) {
    console.error(`Already exists. Use --force to overwrite.\n  ${goFile}\n  ${embedFile}`);
    process.exit(1);
  }

  const base = {
    SLUG: slug,
    ...preset,
  };

  if (typeof args.title === 'string') base.PAGE_TITLE = args.title;
  if (typeof args.description === 'string') base.META_DESCRIPTION = args.description;
  if (typeof args.headline === 'string') base.HEADLINE = args.headline;
  if (typeof args.subhead === 'string') base.SUBHEAD = args.subhead;
  if (typeof args.badge === 'string') base.BADGE = args.badge;
  if (typeof args.cta === 'string') base.CTA_LABEL = args.cta;
  if (typeof args['utm-source'] === 'string') base.UTM_SOURCE = args['utm-source'];
  if (typeof args['utm-medium'] === 'string') base.UTM_MEDIUM = args['utm-medium'];
  if (typeof args['utm-campaign'] === 'string') base.UTM_CAMPAIGN = args['utm-campaign'];

  base.SLUG_JSON = j(base.SLUG);
  base.UTM_SOURCE_JSON = j(base.UTM_SOURCE);
  base.UTM_MEDIUM_JSON = j(base.UTM_MEDIUM);
  base.UTM_CAMPAIGN_JSON = j(base.UTM_CAMPAIGN);

  const template = fs.readFileSync(TEMPLATE, 'utf8');

  function writeMode(isEmbed) {
    const map = {
      ...base,
      EMBED_MODE: isEmbed ? 'embed' : 'full',
      BODY_CLASS: isEmbed ? 'is-embed' : '',
      BASE_TARGET: isEmbed ? '<base target="_top" />' : '',
      TARGET_TOP: isEmbed ? 'target="_top" rel="noopener"' : '',
      CANONICAL_PATH: isEmbed ? `embed/${slug}/` : `go/${slug}/`,
      IS_EMBED_JSON: isEmbed ? 'true' : 'false',
    };
    // Embed medium default for tracking when not overridden
    if (isEmbed && map.UTM_MEDIUM === 'landing') {
      map.UTM_MEDIUM = 'iframe';
      map.UTM_MEDIUM_JSON = j('iframe');
    }
    const outFile = isEmbed ? embedFile : goFile;
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, fill(template, map), 'utf8');
    return outFile;
  }

  const fullPath = writeMode(false);
  const embedPath = writeMode(true);
  writeHub();

  console.log(`✓ Dual-mode splash ready (pick on the fly)

  FULL PAGE  (iframe blocked — X, Reddit, normal ads)
    File: ${path.relative(ROOT, fullPath)}
    URL:  https://www.viralrefer.app/go/${slug}/

  IFRAME OK  (traffic exchanges / surf bars)
    File: ${path.relative(ROOT, embedPath)}
    URL:  https://www.viralrefer.app/embed/${slug}/
    CTAs open the real app with target=_top (break out of frame)

  Hub: https://www.viralrefer.app/go/

Next:
  1. npm run dev → preview both URLs
  2. Deploy to make public
`);
}

/** Mini index of all splash dual URLs */
function writeHub() {
  if (!fs.existsSync(OUT_GO)) return;
  const dirs = fs
    .readdirSync(OUT_GO, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const rows = dirs
    .map(
      (d) => `    <tr>
      <td><strong>${d}</strong></td>
      <td><a href="/go/${d}/">/go/${d}/</a></td>
      <td><a href="/embed/${d}/">/embed/${d}/</a></td>
    </tr>`,
    )
    .join('\n');
  const hub = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ViralRefer splash links · dual mode</title>
  <meta name="robots" content="noindex" />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
  <style>
    body { font-family: system-ui, sans-serif; background: #09090b; color: #fafafa; margin: 0; padding: 2rem 1.25rem; }
    h1 { font-size: 1.35rem; margin-bottom: 0.35rem; }
    p { color: #a1a1aa; font-size: 0.9rem; margin-bottom: 1.25rem; max-width: 36rem; }
    table { width: 100%; max-width: 40rem; border-collapse: collapse; font-size: 0.88rem; }
    th, td { text-align: left; padding: 0.65rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1); }
    th { color: #71717a; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; }
    a { color: #a78bfa; }
    .tag { display: inline-block; font-size: 0.65rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 999px; margin-left: 0.25rem; }
    .full { background: rgba(139,92,246,0.2); color: #c4b5fd; }
    .iframe { background: rgba(34,211,238,0.15); color: #67e8f9; }
  </style>
</head>
<body>
  <h1>Splash pages · both options</h1>
  <p>
    <span class="tag full">FULL</span> = social / posts / normal ads (cannot be iframed).<br />
    <span class="tag iframe">IFRAME</span> = traffic exchanges that load your site in a frame. CTAs break out to the full app.
  </p>
  <table>
    <thead><tr><th>Slug</th><th>Full page</th><th>Iframe OK</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
  <p style="margin-top:1.5rem"><a href="https://www.viralrefer.app/">← viralrefer.app</a></p>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT_GO, 'index.html'), hub, 'utf8');
}

main();
