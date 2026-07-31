'use client';

/**
 * BookingBox — Affiliate-Buchungsflaeche der Aktivitaets-Detailseite
 * (fn-18 Task 5). Visuelles Muster: V4TicketBox (Event-Detail).
 *
 * WARUM CLIENT-KOMPONENTE (nicht optional):
 * Die Viator-API-Nutzungsbedingungen verbieten das Indexieren
 * Viator-spezifischer Inhalte. Titel/Teaser/Bild/Preis duerfen deshalb
 * nicht im serverseitig gerenderten HTML der ISR-Seite stehen — sie
 * werden erst im Browser von /api/activities/[id]/booking geholt
 * (X-Robots-Tag: noindex). Die Aktivitaetsseite selbst bleibt normal
 * indexierbar; nur dieser Block ist fuer Crawler unsichtbar.
 *
 * Pflichten, die hier sichtbar umgesetzt sind:
 *   - rel="sponsored nofollow" (Google-Vorgabe fuer bezahlte Links)
 *   - sichtbare Kennzeichnung "Anzeige · Provisionslink" (EU/AT)
 *   - Preis nur als "ab X EUR" + Hinweis "Preis kann abweichen"
 *     (Viator-Preise sind kurzlebig, taeglicher Refresh)
 *   - data-track="activity_click" (globaler ClickTracker sammelt ein)
 *
 * Graceful degradation: kein Produkt, Fehler oder abgebrochener Fetch ->
 * die Komponente rendert NICHTS. Die Seite darf nie an der Box haengen.
 */

import { useEffect, useState } from 'react';
import type { AffiliateProduct } from '@/lib/affiliate/viator-types';
import { parseAffiliateProduct } from '@/lib/affiliate/viator-types';

/**
 * Fertig uebersetzte Strings. Bewusst als Props statt useTranslations:
 * gleiches Muster wie OpenNowBadge — die Server-Seite loest ICU-Argumente
 * (z. B. {provider}) auf, der Client bekommt reinen Text.
 */
export interface BookingBoxLabels {
  /** "Anzeige · Provisionslink" */
  adLabel: string;
  /** "Buchbar über Viator" (Provider bereits eingesetzt) */
  providerLine: string;
  /** "ab" */
  from: string;
  /** "Preis kann abweichen" */
  priceDisclaimer: string;
  /** "Jetzt ansehen" */
  cta: string;
  /** Suffix hinter der Bewertungszahl: "Bewertungen" */
  reviews: string;
  /** Volle Offenlegung inkl. Provider-Name. */
  disclosure: string;
}

interface BookingBoxProps {
  activityId: string;
  labels: BookingBoxLabels;
}

const PROVIDER = 'Viator';

function formatPrice(value: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat('de-AT', {
      style: 'currency',
      currency: currency ?? 'EUR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency ?? 'EUR'}`;
  }
}

export function BookingBox({ activityId, labels }: BookingBoxProps) {
  const [product, setProduct] = useState<AffiliateProduct | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    fetch(`/api/activities/${activityId}/booking`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        if (cancelled || json == null || typeof json !== 'object') return;
        // Response ist ungeprueft — dieselbe defensive Verengung wie serverseitig.
        setProduct(parseAffiliateProduct((json as { product?: unknown }).product));
      })
      .catch(() => {
        /* Netzfehler/Abbruch: Box bleibt leer, Seite bleibt heil. */
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activityId]);

  if (!product) return null;

  const price =
    product.price_from != null && product.price_from > 0
      ? formatPrice(product.price_from, product.currency)
      : null;

  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6 mt-10">
      <div
        data-booking-box="viator"
        className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated,#141414)]"
        style={{
          border: '1px solid rgba(212,184,150,0.34)',
          boxShadow: '0 6px 28px rgba(0,0,0,0.40)',
        }}
      >
        <div className="h-[3px]" style={{ background: 'var(--v4-ticket,#d4b896)' }} />
        <div className="p-[20px_22px_22px]">
          {/* Sichtbare Werbekennzeichnung — Pflicht, nicht Deko. */}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.12em] border border-[rgba(212,184,150,0.34)] text-[var(--v4-ink-70,#bdbdbd)]">
            {labels.adLabel}
          </span>

          <p className="mt-3.5 mb-1 text-[12px] font-medium text-[var(--v4-ink-70,#bdbdbd)]">
            {labels.providerLine}
          </p>

          <div className="flex gap-3.5">
            {product.image_url && (
              // eslint-disable-next-line @next/next/no-img-element -- Partner-CDN-Hotlink, rein client-seitig (ToS: nicht indexierbar)
              <img
                src={product.image_url}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-[84px] h-[84px] rounded-[12px] object-cover flex-shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-snug text-[var(--v4-ink,#fff)]">
                {product.title}
              </p>
              {product.teaser && (
                <p className="mt-1 text-[12.5px] leading-[1.5] text-[var(--v4-ink-50,#8f8f8f)] line-clamp-2">
                  {product.teaser}
                </p>
              )}
              {product.rating != null && (
                <p className="mt-1.5 text-[12px] text-[var(--v4-ink-70,#bdbdbd)]">
                  ★ {product.rating.toFixed(1)}
                  {product.review_count != null && product.review_count > 0 && (
                    <span className="text-[var(--v4-ink-50,#8f8f8f)]">
                      {' · '}
                      {product.review_count} {labels.reviews}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          {price && (
            <div className="mt-4 flex items-baseline gap-2.5">
              <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[var(--v4-ink-50,#8f8f8f)]">
                {labels.from}
              </span>
              <span className="text-[26px] font-bold tracking-[-0.025em] text-[var(--v4-ink,#fff)]">
                {price}
              </span>
              {/* Preise sind kurzlebig — Hinweis ist Pflicht (Caching-Politik). */}
              <span className="text-[11.5px] text-[var(--v4-ink-50,#8f8f8f)]">
                {labels.priceDisclaimer}
              </span>
            </div>
          )}

          <a
            href={product.url}
            target="_blank"
            rel="sponsored nofollow noopener noreferrer"
            data-track="activity_click"
            data-track-id={activityId}
            data-track-provider={PROVIDER}
            className="press-haptic mt-4 flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-ticket,#d4b896)] text-[#1a1208] text-sm font-semibold"
          >
            {labels.cta}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </a>

          <p className="mt-3 pt-3 border-t border-[var(--v4-hairline-1,rgba(255,255,255,0.08))] text-[11.5px] leading-[1.5] text-[var(--v4-ink-50,#8f8f8f)]">
            {labels.disclosure}
          </p>
        </div>
      </div>
    </section>
  );
}
