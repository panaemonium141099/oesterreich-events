/**
 * Planer motion tokens (fn-15.5 rewrite):
 *
 * Pre-fn-15.5 this file exported motion-lib `Variants` / `Transition`
 * objects (riseItem, fadeScale, staggerContainer, springy, …) that
 * components imported and passed to `motion.div`. After removing
 * motion-lib the variants are inlined as CSS keyframes / Tailwind
 * classes at the call sites, and this file becomes a tiny constants
 * module so any remaining import doesn't break.
 *
 * If you need to add a new animation: prefer a keyframe in
 * `src/app/globals.css` (search for `@keyframes`) and apply it via a
 * utility class. Reserve framer-style spring physics for places that
 * genuinely need them — there's no library in the bundle anymore.
 */

/** Cubic-bezier ease curve — long tail, decisive start. Mirrors the
 *  previous `[0.19, 1, 0.22, 1]` framer cubic. Used as a CSS string. */
export const EASE_OUT_EXPO_CSS = 'cubic-bezier(0.19, 1, 0.22, 1)';

/** Symmetric in-out ease. */
export const EASE_IN_OUT_SLOW_CSS = 'cubic-bezier(0.77, 0, 0.175, 1)';
