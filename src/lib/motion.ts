/**
 * Imperative motion gate for GSAP and DOM-level effects. Components that
 * render markup check this before animating; CSS keyframes are covered by the
 * prefers-reduced-motion block in globals.css instead.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
