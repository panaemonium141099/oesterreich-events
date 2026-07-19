/**
 * V4FreeBox — side-box when state === 'free'.
 *
 * No ticket purchase path; pivots to planning. Green accent stripe +
 * "Abend planen" CTA — calls onPlanClick to open the V4PlanWizard sheet.
 * "Route öffnen" sits in the secondary row whenever mapsUrl is known —
 * the user wants the routing affordance reachable from every state.
 */

import { useTranslations } from 'next-intl';
import { V4Badge } from './V4Badge';
import { V4PriceBlock } from './V4PriceBlock';
import { V4SaveButton } from './V4SaveButton';

interface V4FreeBoxProps {
  /** Required for the Merken-toggle to write into saved_events. */
  eventId: string;
  onPlanClick?: () => void;
  /** Google-Maps-Directions-URL. Without it the Route button collapses. */
  mapsUrl?: string;
  /** True when coords exist but are too approximate to route to. Renders a
   *  non-clickable "Ortsangabe ungefähr" pill in the Route slot instead. */
  locationApprox?: boolean;
  /** Raw price text from the event (e.g. "Spende erwünscht"). Free events
   *  with no price text show no price block — the Eintritt-frei badge above
   *  already conveys the price. */
  priceText?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

export function V4FreeBox({ eventId, onPlanClick, mapsUrl, locationApprox, priceText, priceMin, priceMax }: V4FreeBoxProps) {
  const t = useTranslations('EventDetail');
  const showsLocationCell = !!mapsUrl || !!locationApprox;
  return (
    <div
      data-v4-side-box="free"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid rgba(123,183,148,0.34)' }}
    >
      <div className="h-[3px]" style={{ background: 'var(--v4-go)' }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="free">{t('badgeFree')}</V4Badge>
        <p className="mt-3.5 text-[16px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-tight">
          {t('freeHeadline')}
        </p>
        <p className="mt-2 text-[12.5px] text-[var(--v4-ink-50)] leading-[1.5]">
          {t('freeSub')}
        </p>

        <V4PriceBlock priceText={priceText} priceMin={priceMin} priceMax={priceMax} priceTier="gratis"/>

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
          <a href="#share" className="press-haptic inline-flex items-center justify-center px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[var(--v4-ink)]" aria-label={t('share')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </a>
        </div>
      </div>
    </div>
  );
}
