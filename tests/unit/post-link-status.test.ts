import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearShareDeadlineState,
  writeShareDeadlineState,
} from '../../src/lib/share-deadline';
import {
  POST_LINK_STATUS_ATTR,
  renderPostLinkStatus,
  resolvePostLinkStatus,
} from '../../src/lib/post-link-status';

const LINK = 'https://viralrefer.app/r/VIRAL-TEST01';

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
    document.documentElement.removeAttribute(POST_LINK_STATUS_ATTR);
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute('data-vr-post-link-one');
    document.documentElement.removeAttribute('data-vr-share-locked');
    mount();
    document.documentElement.setAttribute('data-vr-has-link', '1');
  });

  afterEach(() => {
    localStorage.clear();
    clearShareDeadlineState();
    document.body.innerHTML = '';
    document.documentElement.removeAttribute(POST_LINK_STATUS_ATTR);
    document.documentElement.removeAttribute('data-vr-has-link');
    document.documentElement.removeAttribute('data-vr-post-link-one');
    document.documentElement.removeAttribute('data-vr-share-locked');
  });

  it('paints You\'re in before the lock clock exists', () => {
    expect(resolvePostLinkStatus()).toBe('in');
    renderPostLinkStatus();
    expect(document.getElementById('post-link-status-title')?.textContent).toBe("You're in.");
    expect(document.getElementById('post-link-status-line')?.textContent).toBe('Send this. A friend must tap Get my link.');
    expect(document.getElementById('share-deadline-banner')?.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('post-link-primary')).toBeTruthy();
  });

  it('Waiting shows the existing lock clock and no extra button', () => {
    writeShareDeadlineState({
      code: 'VIRAL-TEST01',
      status: 'pending_share',
      createdAt: new Date().toISOString(),
      deadlineAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    });
    renderPostLinkStatus();
    expect(document.getElementById('post-link-status-title')?.textContent).toBe('Waiting');
    expect(document.getElementById('post-link-status-line')?.textContent).toBe('1 friend must tap Get my link');
    expect(document.getElementById('share-deadline-banner')?.classList.contains('hidden')).toBe(false);
    expect(document.querySelectorAll('#referral-section button').length).toBe(2);
  });

  it('expired clock stays Waiting and reads Time\'s up', () => {
    writeShareDeadlineState({
      code: 'VIRAL-TEST01',
      status: 'pending_share',
      createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
      deadlineAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    });
    renderPostLinkStatus();
    expect(document.getElementById('post-link-status-title')?.textContent).toBe('Waiting');
    expect(document.getElementById('share-deadline-countdown')?.textContent).toBe("Time's up");
    expect(document.getElementById('share-deadline-banner')?.classList.contains('hidden')).toBe(false);
  });

  it('Locked is quiet and hides the clock', () => {
    document.documentElement.setAttribute('data-vr-share-locked', '1');
    renderPostLinkStatus();
    expect(document.getElementById('post-link-status-title')?.textContent).toBe('Locked');
    expect(document.getElementById('post-link-status-line')?.textContent).toBe("A friend tapped Get my link. You're on the board.");
    expect(document.getElementById('share-deadline-banner')?.classList.contains('hidden')).toBe(true);
  });

  it('stays hidden on data-vr-post-link-one so You\'re in. does not sit above You\'re racing', () => {
    document.documentElement.setAttribute('data-vr-post-link-one', '1');
    renderPostLinkStatus();
    const status = document.getElementById('post-link-status');
    expect(status?.hidden).toBe(true);
    expect(status?.classList.contains('hidden')).toBe(true);
    expect(document.documentElement.hasAttribute(POST_LINK_STATUS_ATTR)).toBe(false);
    expect(document.getElementById('post-link-heading')?.textContent).toBe("Your link is ready");
  });
});
