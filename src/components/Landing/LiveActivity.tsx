'use client';

import { useState, useEffect } from 'react';

export function LiveActivity() {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Initial random count
    const base = 800 + Math.floor(Math.random() * 700);
    setCount(base);
    // Fade in after a short delay
    const fadeTimer = setTimeout(() => setVisible(true), 1200);

    // Slowly increment randomly
    const interval = setInterval(() => {
      setCount(prev => {
        const delta = Math.random() > 0.5 ? Math.floor(Math.random() * 5) + 1 : -Math.floor(Math.random() * 3);
        const next = prev + delta;
        return Math.max(800, Math.min(2000, next));
      });
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <div
      className={`flex items-center gap-2 justify-center transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ animationDelay: '1s' }}
    >
      {/* Pulsing green dot */}
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
      </span>
      <span className="text-white/30 text-sm">
        <span className="text-white/50 font-medium tabular-nums">{count.toLocaleString('de-AT')}</span> gerade aktiv
      </span>
    </div>
  );
}
