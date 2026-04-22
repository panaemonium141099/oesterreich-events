/**
 * Shared Framer Motion variants for the Planer flow.
 *
 * Motion philosophy:
 *  - Springs, not tweens, whenever possible — they feel alive.
 *  - Stagger children at 0.04-0.08s intervals for "cascade" reveals.
 *  - Page transitions are slow (0.6-0.9s) to feel deliberate; micro-
 *    interactions are fast (0.15-0.3s) to feel snappy.
 *  - `cubic-bezier(0.19, 1, 0.22, 1)` = "easeOutExpo", our default for
 *    entrance / exit curves. Long tail, decisive start.
 */
import type { Variants, Transition } from 'framer-motion';

export const EASE_OUT_EXPO: Transition['ease'] = [0.19, 1, 0.22, 1];
export const EASE_IN_OUT_SLOW: Transition['ease'] = [0.77, 0, 0.175, 1];

/** Container that cascades children into view one at a time */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
};

/** Child item that rises into view — pairs with staggerContainer */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE_OUT_EXPO },
  },
};

/** Small fade-scale for chips, buttons, subtle elements */
export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: EASE_OUT_EXPO },
  },
};

/** Full-screen overlay curtain — used for the Create flow takeover */
export const curtainEnter: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.25, ease: EASE_OUT_EXPO },
  },
};

/** Step-transition slide — for multi-step flows */
export const stepSlide = (direction: 1 | -1): Variants => ({
  hidden: {
    opacity: 0,
    x: 60 * direction,
    transition: { duration: 0.3, ease: EASE_OUT_EXPO },
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    x: -60 * direction,
    transition: { duration: 0.3, ease: EASE_OUT_EXPO },
  },
});

/** Spring preset for interactive bounces (chip select, RSVP toggle) */
export const springy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 28,
  mass: 0.6,
};

/** Gentle spring for sheet/card movements */
export const springSheet: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 32,
  mass: 0.8,
};
