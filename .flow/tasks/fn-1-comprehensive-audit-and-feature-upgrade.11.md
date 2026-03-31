# fn-1-comprehensive-audit-and-feature-upgrade.11 UI Animations and Micro-Interactions

## Description
Add elegant, performant UI animations using Framer Motion. Implement page transitions, EventCard hover effects, loading states, and micro-interactions for save/like/share. Follow existing dark-theme design conventions and respect reduced motion preferences.

**Size:** M
**Files:** package.json, src/app/layout.tsx, src/components/Events/EventCard.tsx, src/components/Events/EventDetail.tsx, src/components/UI/AnimatedLayout.tsx (new), src/components/UI/AnimatedCard.tsx (new)

## Approach
- Install `framer-motion` (tree-shakeable, import only `motion` and `AnimatePresence`)
- Create `AnimatedLayout.tsx` wrapper for page transitions using `AnimatePresence` + `motion.div` — use `layout` prop for smooth transitions
- Add EventCard hover: subtle scale (1.02), shadow lift, image zoom — use `whileHover` for 150ms ease-out
- Add staggered list entry for event lists — `staggerChildren: 0.04` matching existing 30-40ms delay convention
- Add micro-interactions: save button pulse, share button ripple, like heart pop — match existing `active:scale-[0.97]` convention
- Add skeleton → content transition using `AnimatePresence` with fade
- Loading states: shimmer animation on skeleton cards (extend existing `shimmer` keyframe in globals.css)
- Wrap all animations in `motion-reduce` checks — use `useReducedMotion()` from framer-motion
- Keep animations under 300ms, use `ease-out` timing

## Key context
- Existing CSS animations in globals.css (lines 66-133): fadeIn, fadeInUp, scaleIn, slideUp, shimmer, pulseGlow, kenBurns, markerPop
- Existing convention: `active:scale-[0.97] motion-reduce:transform-none` on buttons
- Existing stagger: `animationDelay: ${i * 30}ms` to `${i * 40}ms`
- Dark theme with glassmorphism: `bg-white/[0.03] border border-white/[0.06]`
- The app already has `@media (prefers-reduced-motion: reduce)` support and `motion-reduce:` Tailwind utilities
- Next.js App Router page transitions require layout-level AnimatePresence wrapping
## Acceptance
- [ ] Framer Motion installed (verify tree-shaking — only import what's needed)
- [ ] Page transitions with fade/slide (AnimatePresence in layout)
- [ ] EventCard hover: scale + shadow + image zoom
- [ ] Staggered list animations matching existing timing convention
- [ ] Save/like/share micro-interactions
- [ ] Skeleton → content fade transition
- [ ] All animations respect `prefers-reduced-motion` via `useReducedMotion()`
- [ ] No animation longer than 300ms
- [ ] `npm run build` succeeds
- [ ] Bundle impact measured and documented
## Done summary
Installed framer-motion and implemented UI animations including page transitions (AnimatedLayout with AnimatePresence), staggered EventCard list entry (AnimatedCard with index-based delays matching existing 40ms convention), EventCard hover scale/shadow effects, skeleton-to-content fade transitions, and save/share/like micro-interaction CSS keyframes. All animations respect prefers-reduced-motion via useReducedMotion() and are capped at 300ms.
## Evidence
- Commits: c065b5c0e11d32bfdb53f1cbb121a7374316f5a8
- Tests: npm run build
- PRs: