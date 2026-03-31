'use client';

import { useState, useEffect } from 'react';
import {
  requestGeolocation,
  getStoredLocation,
  storeLocation,
  hasAskedLocation,
  markLocationAsked,
} from '@/lib/geolocation';

interface LocationBannerProps {
  onLocationFound: (lat: number, lng: number) => void;
  eveningMode?: boolean;
  /** If true, suppress the auto-fly on mount (e.g. user arrived via URL with explicit context) */
  suppressAutoFly?: boolean;
}

export function LocationBanner({ onLocationFound, suppressAutoFly = false }: LocationBannerProps) {
  const [visible, setVisible] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const stored = getStoredLocation();
    if (stored) {
      // Only auto-fly to stored location when the user didn't arrive with explicit URL context
      if (!suppressAutoFly) {
        onLocationFound(stored.lat, stored.lng);
      }
      return;
    }
    if (hasAskedLocation()) return;
    const timer = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = () => {
    setClosing(true);
    setTimeout(() => setVisible(false), 180);
  };

  const handleAllow = async () => {
    setRequesting(true);
    markLocationAsked();
    const position = await requestGeolocation();
    if (position) {
      const { latitude, longitude } = position.coords;
      storeLocation(latitude, longitude);
      onLocationFound(latitude, longitude);
    }
    dismiss();
  };

  const handleDismiss = () => {
    markLocationAsked();
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      className={`absolute top-3 left-1/2 -translate-x-1/2 z-[500] location-banner ${
        closing ? 'location-banner-exit' : 'location-banner-enter'
      }`}
    >
      <div className="rounded-2xl bg-[#0a0a0a]/85 backdrop-blur-2xl border border-white/[0.06] shadow-[0_4px_30px_rgba(0,0,0,0.5)] px-4 py-3 flex items-center gap-3 max-w-sm">
        {/* Subtle top gradient line */}
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent rounded-full" />

        {/* Pin icon */}
        <div className="shrink-0 w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>

        {/* Text */}
        <p className="text-[13px] text-white/60 flex-1 leading-snug">
          Standort freigeben für Events in deiner Nähe?
        </p>

        {/* Buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-white/50 hover:text-white/70 transition-colors duration-200 px-2 py-1.5 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none rounded-lg"
          >
            Später
          </button>
          <button
            onClick={handleAllow}
            disabled={requesting}
            className="text-xs bg-blue-500/90 text-white hover:bg-blue-500 transition-all duration-200 px-3.5 py-1.5 rounded-lg font-medium cursor-pointer disabled:opacity-50 min-h-[44px] active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
          >
            {requesting ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none inline-block" />
            ) : 'Erlauben'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .location-banner-enter {
          animation: locSlideDown 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .location-banner-exit {
          animation: locFadeOut 180ms ease-in forwards;
        }
        @keyframes locSlideDown {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes locFadeOut {
          from { opacity: 1; transform: translate(-50%, 0); }
          to { opacity: 0; transform: translate(-50%, -8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .location-banner-enter,
          .location-banner-exit {
            animation: none !important;
          }
          .location-banner-enter {
            opacity: 1;
            transform: translate(-50%, 0);
          }
          .location-banner-exit {
            opacity: 0;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  );
}
