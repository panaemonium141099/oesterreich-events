'use client';

/**
 * V4SortRow — total-count + 4 sort pills. Pure visual atom; parent owns
 * the active sort + total via props.
 */

import { useTranslations } from 'next-intl';

export const SORT_OPTIONS = [
  { key: 'score',    label: 'Empfohlen' },
  { key: 'date',     label: 'Datum' },
  { key: 'tickets',  label: 'Tickets' },
  { key: 'distance', label: 'Nähe' },
] as const;

export type V4SortKey = typeof SORT_OPTIONS[number]['key'];

/** fn-17: Anzeige-Label pro Sort-Key aus dem Discover-Namespace. */
const SORT_MESSAGE_KEYS: Record<V4SortKey, string> = {
  score: 'sortRecommended',
  date: 'sortDate',
  tickets: 'sortTickets',
  distance: 'sortDistance',
};

interface V4SortRowProps {
  current: V4SortKey;
  total: number;
  onChange: (next: V4SortKey) => void;
}

export function V4SortRow({ current, total, onChange }: V4SortRowProps) {
  const t = useTranslations('Discover');
  return (
    <div className="flex items-center gap-3.5 flex-wrap text-[13px] text-[var(--v4-ink-70)]">
      <div>
        <b className="text-[var(--v4-ink)] font-bold">{total}</b> {t('events')}
      </div>
      <div className="flex-1"/>
      <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[var(--v4-ink-50)]">{t('sortLabel')}</span>
      <div className="flex gap-1">
        {SORT_OPTIONS.map(opt => {
          const isActive = opt.key === current;
          return (
            <button
              key={opt.key}
              type="button"
              data-active={isActive}
              onClick={() => onChange(opt.key)}
              className={
                'press-haptic px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ' +
                (isActive
                  ? 'bg-[var(--v4-surface-elevated)] text-[var(--v4-ink)] border-[var(--v4-hairline-3)]'
                  : 'text-[var(--v4-ink-70)] border-transparent hover:text-[var(--v4-ink)]')
              }
            >
              {t(SORT_MESSAGE_KEYS[opt.key])}
            </button>
          );
        })}
      </div>
    </div>
  );
}
