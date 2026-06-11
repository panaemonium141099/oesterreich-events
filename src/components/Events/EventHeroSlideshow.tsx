'use client';

import { useEffect, useState } from 'react';

/**
 * Hero-Diashow für die Event-Detailseite. Crossfade durch mehrere Bilder
 * (event.images), Auto-Wechsel + Pfeile + Dots. Respektiert
 * prefers-reduced-motion (kein Auto-Wechsel, manuell weiter klickbar).
 *
 * Wird als absolute Ebene in den bestehenden Hero gelegt (deckt das statische
 * backgroundImage ab). Nur sinnvoll ab 2 Bildern — der Aufrufer rendert sie
 * sonst nicht.
 */
export function EventHeroSlideshow({
  images,
  intervalMs = 5000,
}: {
  images: string[];
  intervalMs?: number;
}) {
  const [idx, setIdx] = useState(0);
  const [reduce, setReduce] = useState(false);
  const n = images.length;

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(m.matches);
    const fn = () => setReduce(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (reduce || n <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), intervalMs);
    return () => clearInterval(t);
  }, [n, intervalMs, reduce]);

  if (n === 0) return null;
  const go = (i: number) => setIdx(((i % n) + n) % n);

  const arrowStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.18)',
    zIndex: 20,
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          loading={i === 0 ? 'eager' : 'lazy'}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out"
          style={{ objectPosition: 'center 40%', opacity: i === idx ? 1 : 0 }}
        />
      ))}

      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(idx - 1)}
            aria-label="Vorheriges Bild"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md text-white transition-colors hover:bg-black/60"
            style={arrowStyle}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => go(idx + 1)}
            aria-label="Nächstes Bild"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md text-white transition-colors hover:bg-black/60"
            style={arrowStyle}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>

          {/* Dots — top-center, zwischen Breadcrumb (links) und Actions (rechts) */}
          <div
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5"
            style={{ top: 16, zIndex: 20 }}
          >
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => go(i)}
                aria-label={`Bild ${i + 1} von ${n}`}
                aria-current={i === idx}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === idx ? 20 : 7,
                  height: 7,
                  background: i === idx ? '#fff' : 'rgba(255,255,255,0.55)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
