/**
 * V4InPlanBox — side-box when user already has this event in their plan.
 *
 * Green accent. Communicates "you're set — open your plan to manage it".
 */

import { useTranslations } from 'next-intl';
import { V4Badge } from './V4Badge';

interface V4InPlanBoxProps {
  onPlanClick?: () => void;
}

export function V4InPlanBox({ onPlanClick }: V4InPlanBoxProps) {
  const t = useTranslations('EventDetail');
  return (
    <div
      data-v4-side-box="inplan"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid rgba(123,183,148,0.34)' }}
    >
      <div className="h-[3px]" style={{ background: 'var(--v4-go)' }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="inplan">{t('badgeInPlan')}</V4Badge>
        <p className="mt-3.5 text-[16px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-tight">
          {t('inPlanHeadline')}
        </p>

        {onPlanClick ? (
          <button
            type="button"
            onClick={onPlanClick}
            data-track="plan_opened"
            className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold"
          >
            {t('openPlan')}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ) : (
          <a
            href="/saved"
            data-track="plan_opened"
            className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-go)] text-[#062417] text-sm font-semibold"
          >
            {t('openPlan')}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        )}

        <a
          href="/saved"
          data-track="plan_remove"
          className="press-haptic mt-2 inline-flex w-full items-center justify-center gap-1 px-3 py-2 text-[12px] text-[var(--v4-ink-50)]"
        >
          {t('removeFromPlan')}
        </a>
      </div>
    </div>
  );
}
