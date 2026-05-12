'use client';

import type { ReactNode } from 'react';

interface AnimatedCardProps {
  children: ReactNode;
  index?: number;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  style?: React.CSSProperties;
  /** Skip the staggered enter animation — useful for lists that already use
   *  virtualization/infinite scroll where re-ordering should feel instant. */
  animateEnter?: boolean;
}

/**
 * AnimatedCard — fn-15.5 (Bundle-Architektur):
 *
 * Previously this component pulled the entire motion-lib runtime
 * (`motion`, `useReducedMotion`) for a couple of CSS-equivalent effects:
 *   - opacity + 12px-y fade-in on mount, with a stagger delay
 *   - 2px y-lift + soft shadow on hover
 *   - reduced-motion fallback that skipped both
 *
 * All three are pure CSS now. The fade-in uses the existing
 * `animate-fade-in-up` keyframe with an inline `animationDelay` driven by
 * `index` (capped at 400ms like the old framer custom={i} mapping). The
 * hover-lift uses Tailwind transition utilities and ships zero JS. The
 * `motion-reduce:` variant zeroes out both, replacing useReducedMotion.
 */
export function AnimatedCard({
  children,
  index = 0,
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
  style,
  animateEnter = true,
}: AnimatedCardProps) {
  // Match the old framer mapping: `Math.min(i * 0.04, 0.4)` seconds.
  const delayMs = Math.min(index * 40, 400);

  // Combined style: caller's style + the enter-animation delay (only when
  // animateEnter and not reduced-motion — reduced-motion is handled by
  // the `motion-reduce:` variant on the class below).
  const mergedStyle: React.CSSProperties = animateEnter
    ? { ...style, animationDelay: `${delayMs}ms` }
    : style ?? {};

  // Hover-lift via Tailwind:
  //  - `transition-[transform,box-shadow] duration-150 ease-out`
  //  - `hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]`
  //  - `motion-reduce:transform-none motion-reduce:transition-none`
  const baseClasses =
    'transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] motion-reduce:transform-none motion-reduce:transition-none';
  const enterClasses = animateEnter
    ? 'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] motion-reduce:animate-none motion-reduce:opacity-100'
    : '';

  return (
    <div
      className={[baseClasses, enterClasses, className].filter(Boolean).join(' ')}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={mergedStyle}
    >
      {children}
    </div>
  );
}
