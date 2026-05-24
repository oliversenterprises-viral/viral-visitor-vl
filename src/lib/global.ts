/**
 * Global Namespace + Registration Helper
 *
 * Central place for exposing functions on both:
 *   - window[name]          (for onclick="" compatibility)
 *   - ViralRefer[name]      (preferred structured namespace)
 *
 * All public handlers in the app should go through `registerGlobal()`.
 */

export const ViralRefer: any = ((window as any).ViralRefer = (window as any).ViralRefer || {});
ViralRefer.__internal = ViralRefer.__internal || {};

/**
 * Registers a function/value on both:
 *   - ViralRefer[name]
 *   - window[name]   (for HTML onclick compatibility)
 */
export function registerGlobal(name: string, value: any) {
  ViralRefer[name] = value;
  (window as any)[name] = value;
}
