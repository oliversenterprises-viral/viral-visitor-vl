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

const LINK = 'https://viralrefer.app/r/VIRAL-TEST01';

function mount() {
  document.body.innerHTML = `
    <input id="ref-link" value="" />
    <div id="post-link-share" class="hidden" hidden>
      <h2 id="post-link-heading"></h2>
      <p id="post-link-url" tabindex="0"></p>
      <button type="button" id="post-link-primary"></button>
      <button type="button" id="post-link-copy">Copy link</button>
      <p id="post-link-helper"></p>
      <p id="post-link-whisper" class="hidden" hidden></p>
    </div>
  `;
}

describe('post-link-share', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(POST_LINK_ATTR);
    document.documentElement.removeAttribute('data-vr-has-link');
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
      `I'm racing for the ViralRefer homepage — #1 gets a banner for their site. Get a free link and try to beat me. ${LINK}`,
    );
    expect(buildWhatsAppShareHref(LINK)).toContain('wa.me');
    expect(decodeURIComponent(buildWhatsAppShareHref(LINK))).toContain(LINK);
  });

  it('ready state is one primary + quiet copy, no second door', () => {
    showPostLinkReady(LINK);
    expect(document.documentElement.getAttribute(POST_LINK_ATTR)).toBe('1');
    expect(document.getElementById('post-link-heading')?.textContent).toBe('Your link is ready');
    expect(document.getElementById('post-link-url')?.textContent).toBe(LINK);
    const primary = document.getElementById('post-link-primary') as HTMLButtonElement;
    expect(primary.hidden).toBe(false);
    expect(primary.textContent === 'Share with a friend' || primary.textContent === 'Send on WhatsApp').toBe(
      true,
    );
    expect(document.getElementById('post-link-copy')?.textContent).toBe('Copy link');
    expect(document.getElementById('post-link-helper')?.textContent).toMatch(/Get my link/);
    expect(document.querySelectorAll('#post-link-share button:not([hidden])').length).toBe(2);
  });

  it('loading hides the share button', () => {
    showPostLinkLoading();
    const primary = document.getElementById('post-link-primary') as HTMLButtonElement;
    expect(document.getElementById('post-link-heading')?.textContent).toMatch(/Getting your link/);
    expect(primary.hidden).toBe(true);
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
