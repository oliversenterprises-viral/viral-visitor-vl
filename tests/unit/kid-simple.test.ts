import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  initKidSimple,
  isKidMoreOpen,
  isKidSimpleActive,
  setKidMore,
  syncKidSimpleFromLock,
} from '../../src/lib/kid-simple';

describe('kid-simple public flow', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-vr-kid-simple');
    document.documentElement.removeAttribute('data-vr-kid-more');
    document.documentElement.removeAttribute('data-vr-has-link');
    document.body.innerHTML = `<button id="kid-more-tools-btn" type="button">Show extra tools</button>`;
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-vr-kid-simple');
    document.documentElement.removeAttribute('data-vr-kid-more');
  });

  it('turns on for the public site', () => {
    initKidSimple({ pathname: '/', search: '', hash: '' } as Location);
    expect(isKidSimpleActive()).toBe(true);
  });

  it('stays off on embed routes', () => {
    initKidSimple({ pathname: '/embed', search: '', hash: '' } as Location);
    expect(isKidSimpleActive()).toBe(false);
  });

  it('toggles extra tools without removing the button', () => {
    initKidSimple({ pathname: '/', search: '', hash: '' } as Location);
    expect(isKidMoreOpen()).toBe(false);
    setKidMore(true);
    expect(isKidMoreOpen()).toBe(true);
    expect(document.getElementById('kid-more-tools-btn')?.textContent).toBe('Hide extra tools');
    setKidMore(false);
    expect(isKidMoreOpen()).toBe(false);
  });

  it('opens extras when the link is locked', () => {
    initKidSimple({ pathname: '/', search: '', hash: '' } as Location);
    document.documentElement.setAttribute('data-vr-share-locked', '1');
    syncKidSimpleFromLock();
    expect(isKidMoreOpen()).toBe(true);
  });
});
