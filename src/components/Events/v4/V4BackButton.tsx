'use client';

/**
 * V4BackButton — kleiner runder Zurück-Button für Event-Detail
 * (und alle anderen Detail-Surfaces wo man auf die vorherige Seite
 * zurückspringen will).
 *
 * Verhalten:
 *  - Wenn Browser-History existiert (User kam von /entdecken, /map,
 *    /artists, etc.) → router.back() → exakt die vorherige Page mit
 *    erhaltenem Scroll-Position + State.
 *  - Wenn kein History (Direct-URL-Aufruf, externer Link, Cold Tab) →
 *    Fallback auf `/` (oder optional via `fallback` prop konfigurierbar).
 *
 * Visuell: weißer Circular Button mit Pfeil-Icon, halbtransparent
 * gegen den Hero-Hintergrund, dezenter Hover. Positioniert absolut
 * oben-links vom Hero (parent muss `relative` sein).
 */

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

interface V4BackButtonProps {
  /** Fallback-URL wenn keine Browser-History existiert. Default: `/`. */
  fallback?: string;
  /** Optionales Label für Screen-Reader. Default: t('EventDetail.back') = "Zurück". */
  label?: string;
  /** Extra Tailwind-Klassen für Positionierung (z.B. `top-5 left-5`). */
  className?: string;
}

export function V4BackButton({
  fallback = '/',
  label,
  className = '',
}: V4BackButtonProps) {
  const t = useTranslations('EventDetail');
  const router = useRouter();

  function handleClick() {
    // window.history.length > 1 ist nicht 100% verlässlich (kann auf
    // manchen Tabs immer 1 sein) — also zusätzlich versuchen wir
    // router.back() und nutzen referrer als zweiten Fallback.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    // Same-Origin-Referrer → zurück dort hin. Cross-Origin oder leer →
    // Fallback (typischerweise `/`).
    if (typeof document !== 'undefined' && document.referrer) {
      try {
        const ref = new URL(document.referrer);
        if (ref.origin === window.location.origin) {
          router.push(ref.pathname + ref.search);
          return;
        }
      } catch { /* invalid referrer URL */ }
    }
    router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label ?? t('back')}
      className={
        'press-haptic absolute z-10 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border transition-colors ' +
        'bg-[rgba(10,10,12,0.55)] border-[rgba(255,255,255,0.18)] text-white hover:bg-[rgba(10,10,12,0.75)] hover:border-[rgba(255,255,255,0.3)] ' +
        className
      }
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
    </button>
  );
}
