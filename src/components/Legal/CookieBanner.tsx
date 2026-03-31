'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = (type: 'all' | 'necessary') => {
    setClosing(true);
    setTimeout(() => {
      localStorage.setItem('cookie_consent', type);
      localStorage.setItem('cookie_consent_date', new Date().toISOString());
      setVisible(false);
    }, 180);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-[9999] pointer-events-none ${
        closing ? 'cookie-banner-exit' : 'cookie-banner-enter'
      }`}
    >
      {/* Gradient fade at bottom edge */}
      <div className="pointer-events-auto">
        <div className="max-w-lg mx-auto px-4 pb-6 sm:pb-8">
          <div className="relative overflow-hidden rounded-2xl bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_60px_rgba(0,0,0,0.6)]">
            {/* Subtle top gradient line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            <div className="p-5 sm:p-6">
              {/* Header row */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/50">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-white/90">Datenschutz</h3>
              </div>

              {/* Description */}
              <p className="text-[13px] leading-relaxed text-white/60 mb-5">
                Wir verwenden Cookies für Funktionalität und anonyme Nutzungsanalyse.{' '}
                <Link
                  href="/datenschutz"
                  className="text-white/70 font-medium underline underline-offset-2 decoration-white/15 hover:decoration-white/40 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none rounded-sm"
                >
                  Datenschutzerklärung
                </Link>
              </p>

              {/* Buttons */}
              <div className="flex gap-2.5">
                <button
                  onClick={() => accept('necessary')}
                  className="flex-1 px-4 py-2.5 text-[13px] font-medium text-white/60 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.08] hover:text-white/70 hover:border-white/[0.12] transition-all duration-200 min-h-[44px] active:scale-[0.97] motion-reduce:transform-none cursor-pointer focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
                >
                  Nur notwendige
                </button>
                <button
                  onClick={() => accept('all')}
                  className="flex-1 px-4 py-2.5 text-[13px] font-semibold text-black bg-white rounded-xl hover:bg-white/90 transition-all duration-200 min-h-[44px] active:scale-[0.97] motion-reduce:transform-none cursor-pointer focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
                >
                  Alle akzeptieren
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cookie-banner-enter {
          animation: cookieSlideUp 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .cookie-banner-exit {
          animation: cookieFadeOut 180ms ease-in forwards;
        }
        @keyframes cookieSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes cookieFadeOut {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(8px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .cookie-banner-enter,
          .cookie-banner-exit {
            animation: none !important;
          }
          .cookie-banner-enter {
            opacity: 1;
          }
          .cookie-banner-exit {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
