'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface DoubleTapHeartProps {
  show: boolean;
}

export function DoubleTapHeart({ show }: DoubleTapHeartProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.3, ease: [0.17, 0.67, 0.21, 0.99] }}
        >
          <svg className="w-20 h-20 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
