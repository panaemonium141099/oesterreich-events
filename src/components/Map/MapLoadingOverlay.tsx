'use client';

import { useState, useEffect } from 'react';

interface MapLoadingOverlayProps {
  loading: boolean;
  eventCount: number;
}

export function MapLoadingOverlay({ loading, eventCount }: MapLoadingOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!loading && eventCount > 0) {
      // Start fade-out
      setFadeOut(true);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [loading, eventCount]);

  if (!visible) return null;

  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-300 ease-out ${
        fadeOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Pulsing ring + map pin icon */}
        <div className="relative flex items-center justify-center">
          {/* Outer pulsing ring */}
          <span className="absolute w-20 h-20 rounded-full border-2 border-white/20 animate-map-loader-ring" />
          {/* Inner pulsing ring */}
          <span className="absolute w-14 h-14 rounded-full border border-white/10 animate-map-loader-ring-inner" />
          {/* Center icon */}
          <div className="relative w-12 h-12 rounded-full bg-black/60 border border-white/10 flex items-center justify-center backdrop-blur-sm">
            <svg className="w-6 h-6 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="text-center">
          <p className="text-white/70 text-sm font-medium animate-map-loader-text">
            Events werden geladen...
          </p>
          {eventCount > 0 && (
            <p className="text-white/40 text-xs mt-1.5 tabular-nums">
              {eventCount.toLocaleString('de-AT')} Events gefunden
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
