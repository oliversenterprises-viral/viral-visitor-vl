function sessionId(): string {
  const k = 'vr-ultra-session';
  let s = sessionStorage.getItem(k);
  if (!s) {
    s = Math.random().toString(16).slice(2) + Date.now().toString(16);
    sessionStorage.setItem(k, s);
  }
  return s;
}

export function track(kind: string, extra: { platform?: string; utm?: string } = {}): void {
  const utm = extra.utm || new URLSearchParams(location.search).get('utm_source') || undefined;
  void fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, platform: extra.platform, utm, session: sessionId(), referrer: document.referrer }),
    keepalive: true,
  }).catch(() => {});
}
