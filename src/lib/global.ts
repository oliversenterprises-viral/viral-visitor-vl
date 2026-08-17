/**
 * Global Namespace + Registration Helper
 *
 * Central place for exposing functions on both:
 *   - window[name]          (for onclick="" compatibility)
 *   - ViralRefer[name]      (preferred structured namespace)
 *
 * All public handlers in the app should go through `registerGlobal()`.
 */

export type ViralReferNamespace = {
  __internal: Record<string, unknown>;
  referralBaseUrl?: string;
  shareMessageTemplate?: string;
  myReferralCode?: string;
  showToast?: (message: string, type?: 'success' | 'info') => void;
  switchAdminTab?: (tab: number) => void;
  openAdminPanel?: () => void | Promise<void>;
  getMyReferralLinkInstant?: () => void;
  renderMyStats?: (code: string | null) => void | Promise<void>;
  [key: string]: unknown;
};

function windowRecord(): Record<string, unknown> {
  return window as unknown as Record<string, unknown>;
}

export const ViralRefer: ViralReferNamespace = (() => {
  const w = windowRecord();
  const existing = w.ViralRefer;
  const ns = (
    existing && typeof existing === 'object' ? existing : {}
  ) as ViralReferNamespace;
  ns.__internal =
    ns.__internal && typeof ns.__internal === 'object'
      ? (ns.__internal as Record<string, unknown>)
      : {};
  w.ViralRefer = ns;
  return ns;
})();

export function setWindowProp(name: string, value: unknown): void {
  windowRecord()[name] = value;
}

/**
 * Registers a function/value on both:
 *   - ViralRefer[name]
 *   - window[name]   (for HTML onclick compatibility)
 */
export function registerGlobal(name: string, value: unknown): void {
  ViralRefer[name] = value;
  setWindowProp(name, value);
}
