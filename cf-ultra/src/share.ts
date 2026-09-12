import { RUNG_COPY, shareMessage, type Rung } from '../functions/_lib/engine';
import { renderSVG } from 'uqr';

export function intents(shareUrl: string, host: string, rung: Rung) {
  const text = shareMessage(host, shareUrl, rung);
  const e = encodeURIComponent;
  return {
    text,
    whatsapp: `https://wa.me/?text=${e(text)}`,
    x: `https://twitter.com/intent/tweet?text=${e(text)}`,
    telegram: `https://t.me/share/url?url=${e(shareUrl)}&text=${e(text)}`,
    reddit: `https://www.reddit.com/submit?url=${e(shareUrl)}&title=${e(`${host} is ${RUNG_COPY[rung].title} on ViralRefer Ultra`)}`,
  };
}

export function qrSvg(shareUrl: string): string {
  return renderSVG(shareUrl, { border: 2 });
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = value;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  }
}

export async function nativeShare(shareUrl: string, host: string, rung: Rung): Promise<boolean> {
  if (!navigator.share) return false;
  try {
    await navigator.share({ title: host, text: shareMessage(host, shareUrl, rung), url: shareUrl });
    return true;
  } catch {
    return false;
  }
}
