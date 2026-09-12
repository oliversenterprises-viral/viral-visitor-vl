/** Cache API helpers. No-ops outside the Worker runtime. Never used for personalized /me or join. */

export function publicCacheKey(request: Request, path: string): Request {
  const url = new URL(path, new URL(request.url).origin);
  return new Request(url.toString(), { method: 'GET' });
}

export async function edgeMatch(key: Request): Promise<Response | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const hit = await caches.default.match(key);
    return hit ?? null;
  } catch {
    return null;
  }
}

export async function edgePut(key: Request, response: Response): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    await caches.default.put(key, response);
  } catch {
    /* preview / quota — ignore */
  }
}

export async function edgeBust(request: Request, paths: string[]): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    await Promise.all(paths.map((path) => caches.default.delete(publicCacheKey(request, path))));
  } catch {
    /* ignore */
  }
}
