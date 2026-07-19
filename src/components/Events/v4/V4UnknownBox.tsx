/**
 * V4UnknownBox — side-box when we can't infer a ticket path (no
 * online shop known, no free/doorsale flag).
 *
 * Visual: green accent stripe + green border tint (same as V4FreeBox).
 * The user asked for one consistent "planning" card across every state
 * that has no live ticket purchase path — both this box and the free box
 * read as the same green planning surface, only the badge + headline
 * change to keep the ticket-availability info honest. Route öffnen is
 * always available (alongside Merken) so the user can navigate even
 * when no ticket flow exists.
 */

import { useTranslations } from 'next-intl';
import { V4Badge } from './V4Badge';
import { V4PriceBlock } from './V4PriceBlock';
import { V4SaveButton } from './V4SaveButton';

interface V4UnknownBoxProps {
  /** Required for the Merken-toggle to write into saved_events. */
  eventId: string;
  /** Open the V4PlanWizard sheet. When omitted, the planning CTA links
   *  to /saved as a fallback (server-rendered anonymous view). */
  onPlanClick?: () => void;
  /** Google-Maps-Directions-URL für die "Route öffnen"-Aktion. Fehlt sie
   *  (Event ohne Koordinaten), wird der Button gar nicht gerendert. */
  mapsUrl?: string;
  /** True when coords exist but are too approximate to route to. Renders a
   *  non-clickable "Ortsangabe ungefähr" pill in the Route slot instead. */
  locationApprox?: boolean;
  /** Raw price text from the event row. The PriceBlock parses it into
   *  labelled rows when separators are present. */
  priceText?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  /** Event price tier — used to suppress the block for explicitly
   *  free events (badge already conveys it). */
  priceTier?: 'gratis' | 'günstig' | 'mittel' | 'premium' | 'unbekannt' | null;
}

export function V4UnknownBox({ eventId, onPlanClick, mapsUrl, locationApprox, priceText, priceMin, priceMax, priceTier }: V4UnknownBoxProps) {
  const t = useTranslations('EventDetail');
  const showsLocationCell = !!mapsUrl || !!locationApprox;
  return (
    <div
      data-v4-side-box="unknown"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid rgba(123,183,148,0.34)' }}
    >
      <div className="h-[3px]" style={{ background: 'var(--v4-go)' }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="unknown">{t('badgeUnknown')}</V4Badge>
        <p className="mt-3.5 text-[15.5px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-[1.4]">
          {t('unknownHeadline')}
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--v4-ink-50)] leading-[1.5]">
          {t('unknownSub')}
        </p>

        <V4PriceBlock priceText={priceText} priceMin={priceMin} priceMax={priceMax} priceTier={priceTier}/>

        {onPlanClick ? (
          <button
            type="button"
            onClick={onPlanClick}
            data-track="plan_started"
            className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold"
          >
            {t('planEvening')}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ) : (
          <a
            href="/saved"
            data-track="plan_started"
            className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold"
          >
            {t('planEvening')}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        )}

        <div className="mt-2.5 flex gap-2">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-track="route_opened"
              className="press-haptic flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]"
            >
              {t('openRoute')}
            </a>
          ) : locationApprox ? (
            <span
              title={t('locationApproxHint')}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-dashed border-[var(--v4-hairline-3)] text-[11.5px] font-medium text-[var(--v4-ink-50)] cursor-help"
            >
              {t('locationApprox')}
            </span>
          ) : null}
          <V4SaveButton eventId={eventId} fillRow={!showsLocationCell} />
        </div>
      </div>
    </div>
  );
}
