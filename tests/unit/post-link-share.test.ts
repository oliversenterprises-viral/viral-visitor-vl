import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildPostLinkShareText,
  buildWhatsAppShareHref,
  canUseNativeShare,
  showPostLinkLoading,
  showPostLinkReady,
  showPostLinkError,
  activatePostLinkShare,
  onPostLinkPrimaryTap,
  onPostLinkCopyTap,
  POST_LINK_ATTR,
} from '../../src/lib/post-link-share';
import { setLocale } from '../../src/lib/i18n';

const LINK = 'https://viralrefer.app/r/VIRAL-TEST01';

function mount() {
  document.body.innerHTML = `
    <input id="ref-link" value="" />
    <div id="post-link-share" class="hidden" hidden>
      <h2 id="post-link-heading"></h2>
      <p id="post-link-sub"></p>
      <p id="post-link-clock" hidden></p>
      <p id="post-link-url" tabindex="0"></p>
      <button type="button" id="post-link-primary"></button>
      <button type="button" id="post-link-copy">Copy link</button>
      <p id="post-link-helper"></p>
      <p id="post-link-tool"></p>
      <p id="post-link-whisper" class="hidden" hidden></p>
    </div>
  `;
}

describe('post-link-share', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(POST_LINK_ATTR);
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute('data-vr-did-send');
    document.documentElement.removeAttribute('data-vr-paste-after-send');
    document.documentElement.removeAttribute('data-vr-share-pending');
    document.documentElement.removeAttribute('data-vr-share-locked');
    mount();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('builds Lumina payload with the raw /r/ link', () => {
    const text = buildPostLinkShareText(LINK);
    expect(text).toBe(
      `I'm racing on ViralRefer — Site Drops put my site on the homepage as I climb. #1 gets the banner for 7 days. Tap Get my link. Visiting does not count. ${LINK}`,
    );
    expect(buildWhatsAppShareHref(LINK)).toContain('wa.me');
    expect(decodeURIComponent(buildWhatsAppShareHref(LINK))).toContain(LINK);
  });

  it('Spanish send caption uses Obtener mi enlace and visiting does not count', () => {
    setLocale('es');
    const text = buildPostLinkShareText(LINK);
    expect(text).toContain('Site Drops');
    expect(text).toMatch(/Obtener mi enlace/);
    expect(text).toMatch(/Visitar no cuenta/);
    expect(text).toContain(LINK);
    expect(text).not.toMatch(/Tap Get my link/);
    setLocale('en');
  });

  it('ready state is one primary + quiet copy, no second door', () => {
    showPostLinkReady(LINK);
    expect(document.documentElement.getAttribute(POST_LINK_ATTR)).toBe('1');
    expect(document.getElementById('post-link-heading')?.textContent).toBe("You're racing.");
    expect(document.getElementById('post-link-sub')?.textContent).toBe(
      "Send it now. A friend must tap Get my link — that's how you climb.",
    );
    expect((document.getElementById('post-link-clock') as HTMLElement).hidden).toBe(true);
    expect(document.getElementById('post-link-url')?.textContent).toBe(LINK);
    expect(document.getElementById('post-link-tool')?.textContent).toContain(
      'This is your public link. Paste it in any bio, story, or text.',
    );
    const primary = document.getElementById('post-link-primary') as HTMLButtonElement;
    expect(primary.hidden).toBe(false);
    expect(primary.textContent).toBe('Send it now');
    expect(document.activeElement).toBe(primary);
    expect(document.getElementById('post-link-copy')?.textContent).toBe('Copy link');
    expect(document.getElementById('post-link-helper')?.textContent).toBe('');
    expect(document.querySelectorAll('#post-link-share button:not([hidden])').length).toBe(2);
  });

  it('loading keeps Send visible as Getting your link', () => {
    showPostLinkLoading();
    const primary = document.getElementById('post-link-primary') as HTMLButtonElement;
    expect(document.getElementById('post-link-heading')?.textContent).toMatch(/Getting your link/);
    expect(primary.hidden).toBe(false);
    expect(primary.disabled).toBe(true);
    expect(primary.textContent).toMatch(/Getting your link/);
  });

  it('error turns primary into Try again and hides copy', () => {
    showPostLinkError();
    expect(document.getElementById('post-link-heading')?.textContent).toMatch(/Couldn/);
    expect(document.getElementById('post-link-primary')?.textContent).toBe('Try again');
    expect((document.getElementById('post-link-copy') as HTMLButtonElement).hidden).toBe(true);
  });

  it('missing code does not render share or copy', () => {
    showPostLinkReady('');
    expect(document.getElementById('post-link-share')?.hidden).toBe(true);
  });

  it('canUseNativeShare is false without navigator.share', () => {
    expect(canUseNativeShare({ title: 'ViralRefer', text: 'x' })).toBe(false);
  });

  it('primary tap without native share opens WhatsApp', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    activatePostLinkShare(LINK);
    onPostLinkPrimaryTap();
    expect(open).toHaveBeenCalled();
    expect(String(open.mock.calls[0]?.[0])).toContain('wa.me');
    expect(document.documentElement.getAttribute('data-vr-did-send')).toBe('1');
  });

  it('copy writes the URL only, not the share sentence', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    activatePostLinkShare(LINK);
    await onPostLinkCopyTap();
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(writeText.mock.calls[0][0]).not.toMatch(/Race me/);
    expect(document.getElementById('post-link-copy')?.textContent).toBe('Copy link');
  });
});
