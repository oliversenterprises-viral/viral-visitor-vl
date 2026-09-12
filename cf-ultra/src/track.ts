function sessionId(): string {
  const k = 'vr-ultra-session';
  let s = sessionStorage.getItem(k);
  if (!s) {
    s = Math.random().toString(16).slice(2) + Date.now().toString(16);
    sessionStorage.setItem(k, s);
  }
  return s;
}

export function track(
  kind: string,
  extra: { platform?: string; utm?: string; host?: string; src?: string; camp?: string; te?: boolean } = {},
): void {
  const q = new URLSearchParams(location.search);
  const utm = extra.utm || q.get('utm_source') || undefined;
  const src = extra.src || q.get('src') || undefined;
  const camp = extra.camp || q.get('camp') || q.get('c') || undefined;
  void fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind,
      platform: extra.platform,
      utm,
      host: extra.host,
      src,
      camp,
      te: extra.te || src === 'te',
      session: sessionId(),
      referrer: document.referrer,
    }),
    keepalive: true,
  }).catch(() => {});
}
