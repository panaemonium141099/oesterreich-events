'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

const SLIDES = [
  {
    titleKey: 'slide1Title' as const,
    textKey: 'slide1Text' as const,
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    titleKey: 'slide2Title' as const,
    textKey: 'slide2Text' as const,
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
  },
  {
    titleKey: 'slide3Title' as const,
    textKey: 'slide3Text' as const,
    icon: (
      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Onboarding() {
  const t = useTranslations('Onboarding');
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('onboarding_complete')) {
      setVisible(true);
    }
  }, []);

  const complete = () => {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem('onboarding_complete', '1');
      setVisible(false);
    }, 300);
  };

  const next = () => {
    if (step < SLIDES.length - 1) {
      setStep(step + 1);
    } else {
      complete();
    }
  };

  if (!visible) return null;

  const slide = SLIDES[step];

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Card */}
      <div className="relative z-10 w-[340px] max-w-[90vw] bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
        {/* Skip */}
        <button
          onClick={complete}
          className="absolute top-4 right-4 text-white/30 hover:text-white/60 text-xs font-medium transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {t('skip')}
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6 text-white/80">
          <div
            key={step}
            className="animate-fade-in-up"
            style={{ animationDuration: '0.25s' }}
          >
            {slide.icon}
          </div>
        </div>

        {/* Text */}
        <div key={step} className="animate-fade-in" style={{ animationDuration: '0.25s' }}>
          <h2 className="text-2xl font-bold text-white mb-2">{t(slide.titleKey)}</h2>
          <p className="text-white/50 text-sm">{t(slide.textKey)}</p>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-8 mb-6">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                i === step ? 'bg-white w-5' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Next button */}
        <button
          onClick={next}
          className="w-full py-3 bg-white text-black font-semibold rounded-xl text-sm hover:bg-white/90 transition-colors min-h-[44px]"
        >
          {step < SLIDES.length - 1 ? t('next') : t('start')}
        </button>
      </div>
    </div>
  );
}
