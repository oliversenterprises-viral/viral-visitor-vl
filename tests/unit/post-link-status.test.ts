import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearShareDeadlineState,
  writeShareDeadlineState,
} from '../../src/lib/share-deadline';
import {
  POST_LINK_COPY_TOAST,
  POST_LINK_STATUS_ATTR,
  initPostLinkStatus,
  renderPostLinkStatus,
  resolvePostLinkStatus,
} from '../../src/lib/post-link-status';

const LINK = 'https://viralrefer.app/r/VIRAL-TEST01';

const toast = vi.hoisted(() => vi.fn());
vi.mock('../../src/ui', () => ({
  showToast: toast,
}));

function mount() {
  document.body.innerHTML = `
    <input id="ref-link" value="${LINK}" />
    <div id="referral-section" data-vr-post-link-stack>
      <div id="post-link-status" class="hidden" hidden data-state="hidden">
        <h2 id="post-link-status-title"></h2>
        <p id="post-link-status-line"></p>
        <div id="share-deadline-banner" class="hidden" hidden>
          <div id="share-deadline-countdown">48h</div>
        </div>
      </div>
      <div id="post-link-share">
        <h2 id="post-link-heading">Your link is ready</h2>
        <button type="button" id="post-link-primary">Share with a friend</button>
        <button type="button" id="post-link-copy">Copy link</button>
      </div>
    </div>
  `;
}

describe('post-link status', () => {
  beforeEach(() => {
    localStorage.clear();
    clearShareDeadlineState();
    toast.mockClear();
    document.documentElement.removeAttribute(POST_LINK_STATUS_ATTR);
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute('data-vr-share-locked');
    document.documentElement.removeAttribute('data-vr-share-pending');
    document.documentElement.removeAttribute('data-vr-post-link-one');
    mount();
    document.documentElement.setAttribute('data-vr-has-link', '1');
  });

  afterEach(() => {
    localStorage.clear();
    clearShareDeadlineState();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute(POST_LINK_STATUS_ATTR);
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute('data-vr-share-locked');
  });

  it('first paint is You\'re in with no clock and the #31 share only', () => {
    expect(resolvePostLinkStatus()).toBe('in');
    renderPostLinkStatus();
    expect(document.documentElement.getAttribute(POST_LINK_STATUS_ATTR)).toBe('in');
    expect(document.getElementById('post-link-status-title')?.textContent).toBe("You're in.");
    expect(document.getElementById('post-link-status-line')?.textContent).toBe(
      'Send this. A friend must tap Get my link.',
    );
    expect(document.getElementById('share-deadline-banner')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('post-link-primary')?.textContent).toBe('Share with a friend');
    expect(document.getElementById('post-link-copy')?.textContent).toBe('Copy link');
    expect(document.querySelectorAll('#referral-section button').length).toBe(2);
  });

  it('Waiting shows the existing 48h clock and no extra button', () => {
    writeShareDeadlineState({
      code: 'VIRAL-TEST01',
      status: 'pending_share',
      createdAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + 47 * 60 * 60 * 1000 + 12 * 60 * 1000).toISOString(),
    });
    expect(resolvePostLinkStatus()).toBe('waiting');
    renderPostLinkStatus();
    expect(document.documentElement.getAttribute(POST_LINK_STATUS_ATTR)).toBe('waiting');
    expect(document.getElementById('post-link-status-title')?.textContent).toBe('Waiting');
    expect(document.getElementById('post-link-status-line')?.textContent).toBe(
      '1 friend must tap Get my link',
    );
    expect(document.getElementById('share-deadline-banner')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('share-deadline-countdown')?.textContent).toBe('47h 12m');
    expect(document.querySelectorAll('#referral-section button').length).toBe(2);
  });

  it('expired stays Waiting and clock reads Time\'s up', () => {
    writeShareDeadlineState({
      code: 'VIRAL-TEST01',
      status: 'expired',
      createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
      deadlineAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(resolvePostLinkStatus()).toBe('waiting');
    renderPostLinkStatus();
    expect(document.getElementById('post-link-status-title')?.textContent).toBe('Waiting');
    expect(document.getElementById('share-deadline-banner')?.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('share-deadline-countdown')?.textContent).toBe("Time's up");
  });

  it('Locked is quiet, hides the clock, and keeps #31 share', () => {
    document.documentElement.setAttribute('data-vr-share-locked', '1');
    expect(resolvePostLinkStatus()).toBe('locked');
    renderPostLinkStatus();
    expect(document.getElementById('post-link-status-title')?.textContent).toBe('Locked');
    expect(document.getElementById('post-link-status-line')?.textContent).toBe(
      "A friend tapped Get my link. You're on the board.",
    );
    expect(document.getElementById('share-deadline-banner')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('post-link-primary')?.textContent).toBe('Share with a friend');
    expect(document.getElementById('post-link-copy')?.textContent).toBe('Copy link');
  });

  it('copy toast never looks like done', () => {
    initPostLinkStatus();
    document.getElementById('post-link-copy')?.click();
    expect(toast).toHaveBeenCalledWith(POST_LINK_COPY_TOAST, 'info');
    expect(POST_LINK_COPY_TOAST).toBe('Link copied. A friend still has to tap Get my link.');
  });
});
