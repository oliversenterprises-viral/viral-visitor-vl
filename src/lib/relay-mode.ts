/**
 * ViralRefer Relay route detection — /relay and /traffic.
 */

const RELAY_PATH_RE = /^\/(relay|traffic)\/?$/i;

export function isRelayPathname(pathname: string): boolean {
  return RELAY_PATH_RE.test(pathname);
}

export function isRelayMode(loc: Location = location): boolean {
  return isRelayPathname(loc.pathname);
}

/** Canonical public path for share links. */
export function getRelayCanonicalPath(): string {
  return '/relay';
}
