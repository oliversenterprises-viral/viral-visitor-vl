import { describe, it, expect } from 'vitest';
import {
  validateBannerImageFile,
  sanitizeBannerFileName,
  BANNER_UPLOAD_MAX_BYTES,
} from '../../src/lib/banner-upload';

describe('banner upload helpers', () => {
  it('validateBannerImageFile rejects unsupported types', () => {
    const file = new File(['x'], 'bad.pdf', { type: 'application/pdf' });
    expect(validateBannerImageFile(file)).toMatch(/JPG/);
  });

  it('validateBannerImageFile rejects oversized files', () => {
    const big = new Uint8Array(BANNER_UPLOAD_MAX_BYTES + 1);
    const file = new File([big], 'big.jpg', { type: 'image/jpeg' });
    expect(validateBannerImageFile(file)).toMatch(/2MB/);
  });

  it('validateBannerImageFile accepts valid images', () => {
    const file = new File(['img'], 'banner.png', { type: 'image/png' });
    expect(validateBannerImageFile(file)).toBeNull();
  });

  it('sanitizeBannerFileName strips unsafe characters', () => {
    expect(sanitizeBannerFileName('../../evil name!.jpg')).toBe('evil-name-.jpg');
    expect(sanitizeBannerFileName('')).toBe('banner');
  });
});