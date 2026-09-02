/**
 * TourBox — GetYourGuide-Touren-Box (fn-22).
 *
 * Eine Box, vier Platzierungen: Event-Detail, Gemeinde-Hub,
 * Aktivitaets-Detail und Blog. Sie verlinkt auf die GYG-Zielseite des
 * Ortes (oder, wenn der Ort keine hat, die des Bundeslands) — reine
 * Links, kein Fremd-Script, kein Consent-Thema, kein Layout-Shift.
 * Fremde Titel/Preise rendern wir nicht: ohne Partner-API haben wir
 * keine Produktdaten, und geraten wird hier nichts.
 *
 * Rendert NICHTS, wenn:
 *   - das Flag/die partner_id fehlen (Default: aus), oder
 *   - sich weder Ort noch Bundesland auf ein GYG-Ziel abbilden lassen.
 * Ein leerer Rahmen ist schlimmer als keine Box.
 *
 * Pflichten (Muster: V4NearbyStays / BookingBox):
 *   - sichtbares "Anzeige"-Label
 *   - rel="sponsored nofollow noopener noreferrer"
 *   - data-track="tour_click" fuer den globalen ClickTracker
 */

import { getLocale, getTranslations } from 'next-intl/server';
import {
  buildGygDestinationLink,
  gygPartnerId,
  isGygWidgetEnabled,
} from '@/lib/affiliate/gyg-links';
import {
  gygLocationId,
  qualifiesForWidget,
  resolveGygDestination,
  type GygResolveInput,
} from '@/lib/affiliate/gyg-destinations';
import { GygWidget } from '@/components/Affiliate/GygWidget';

export interface TourBoxProps extends GygResolveInput {
  /** Platzierung fuer die Auswertung: "event-1a2b3c4d", "gemeinde-eisenstadt". */
  placement: string;
  /** Dunkle v4-Seiten (Default) vs. heller Blog. */
  tone?: 'dark' | 'light';
  /**
   * Echtes GYG-Widget statt des schlichten Links:
   *   'city' — Top-Touren des Ortes (nur bei genug Angebot, sonst Link)
   *   'auto' — waehlt anhand des umgebenden Artikeltexts (Blog)
   * Auf Event-Detailseiten bewusst nicht gesetzt: dort bleibt die Seite
   * fremd-script-frei. Fuehrt zu Fremd-JS, deshalb Opt-in pro Ort.
   */
  widget?: 'city' | 'auto' | false;
  /**
   * 'section' bringt den vollen Seitenrahmen mit (Event-Detail, wo die Box
   * als eigener Streifen steht); 'inline' liefert nur die Karte, wenn die
   * Seite ihren eigenen Container hat (Gemeinde-Hub, Aktivitaets-Detail).
   */
  layout?: 'section' | 'inline';
  className?: string;
}

export async function TourBox({
  placement,
  tone = 'dark',
  layout = 'section',
  widget = false,
  className = '',
  ...where
}: TourBoxProps) {
  const destination = resolveGygDestination(where);
  if (!destination) return null;

  const locale = await getLocale();
  const href = buildGygDestinationLink(destination, { placement, locale });
  if (!href) return null;

  const t = await getTranslations('Tours');
  const place = destination.name;

  const locationId = gygLocationId(destination);
  // Widget nur dort, wo der Ort wirklich Angebot hat (>= 30 Touren) —
  // sonst bliebe von einem Fremd-Script eine halbleere Flaeche uebrig und
  // die duennen Orte tragen die Ladezeit ohne Gegenwert. Ueberall sonst
  // bleibt der scriptfreie Link.
  const widgetKind =
    widget && isGygWidgetEnabled() && qualifiesForWidget(destination)
      ? widget === 'city' && locationId == null
        ? null
        : widget
      : null;

  const link = (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
      data-track="tour_click"
      data-track-id={placement}
      data-track-provider="getyourguide"
      className={
        tone === 'light'
          ? 'inline-flex items-center gap-1.5 bg-gray-900 text-white font-semibold px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors text-xs whitespace-nowrap shrink-0'
          : 'press-haptic inline-flex items-center gap-1.5 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold px-4 py-2 w-fit'
      }
    >
      {t('cta')}
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="w-3 h-3"
        aria-hidden="true"
      >
        <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );

  const widgetNode = widgetKind ? (
    <GygWidget
      partnerId={gygPartnerId()}
      kind={widgetKind}
      locationId={locationId}
      localeCode={locale === 'en' ? 'en-US' : 'de-DE'}
      minHeight={tone === 'light' ? 380 : 420}
      className={tone === 'dark' ? 'rounded-xl overflow-hidden bg-white' : ''}
    />
  ) : null;

  if (tone === 'light') {
    return (
      <section className={`mb-14 border border-gray-200 rounded-xl overflow-hidden bg-white ${className}`}>
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
            {t('heading', { place })}
          </p>
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
            {t('adLabel')}
          </span>
        </div>
        {widgetNode ? (
          <div className="px-6 py-4">
            <p className="font-semibold text-gray-900 text-sm leading-snug mb-4">
              {t('lead', { place })}
            </p>
            {widgetNode}
          </div>
        ) : (
          <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 text-sm leading-snug">{t('lead', { place })}</p>
              <p className="text-gray-400 text-xs mt-0.5">{t('sub')}</p>
            </div>
            {link}
          </div>
        )}
      </section>
    );
  }

  const card = (
    <div className="rounded-2xl border border-[var(--v4-hairline-2)] bg-[var(--v4-surface-elevated)] p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            {t('eyebrow')}
          </p>
          <h2 className="text-[19px] md:text-[22px] font-bold leading-tight tracking-[-0.025em]">
            {t('heading', { place })}
          </h2>
          <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--v4-ink-70)]">
            {t('lead', { place })}
          </p>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--v4-ink-50)] border border-[var(--v4-hairline-3)] rounded px-1.5 py-0.5 shrink-0">
          {t('adLabel')}
        </span>
      </div>
      <div className="mt-4">{widgetNode ?? link}</div>
    </div>
  );

  if (layout === 'inline') return <div className={className}>{card}</div>;

  return (
    <section className={`bg-[var(--v4-surface)] text-[var(--v4-ink)] ${className}`}>
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 pb-10 md:pb-14">{card}</div>
    </section>
  );
}
