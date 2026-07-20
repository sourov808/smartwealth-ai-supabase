import type { Transition, Variants } from "motion/react";

/**
 * Every animation in the app comes from here.
 *
 * Before this, timings were written inline per component, so nothing shared a
 * rhythm and small drifts (0.2s here, 0.3s there) read as sloppiness. Three
 * variants cover every case the UI actually has.
 */

/** Content arriving: a short rise, no scale. Scale on text looks like a zoom bug. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

/** Parent of a list or grid. Children must use `fadeUp`. */
export const stagger: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

/** Panels that slide in from an edge — chat drawer, mobile nav. */
export const drawerSpring: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 38,
  mass: 0.9,
};

/** Modal box. Enters slightly small so it reads as arriving, not cutting in. */
export const modalPop: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: { duration: 0.14 },
  },
};

/** Backdrops. Flat scrim, no blur. */
export const scrim: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};
