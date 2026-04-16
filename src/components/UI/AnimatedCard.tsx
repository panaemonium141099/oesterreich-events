'use client';

import { motion, useReducedMotion } from 'framer-motion';
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

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(i * 0.04, 0.4),
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    },
  }),
};

const hoverEffect = {
  y: -2,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  transition: { duration: 0.15, ease: 'easeOut' as const },
};

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
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion || !animateEnter) {
    return (
      <motion.div
        whileHover={shouldReduceMotion ? undefined : hoverEffect}
        className={className}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={style}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      whileHover={hoverEffect}
      className={className}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      {children}
    </motion.div>
  );
}
