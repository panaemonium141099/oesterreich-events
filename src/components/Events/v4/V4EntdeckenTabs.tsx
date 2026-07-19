'use client';

/**
 * V4EntdeckenTabs — segmented control switching between Liste and
 * Smart-Suche modes on /entdecken. Parent owns the current mode +
 * URL persistence; this atom is pure render.
 */

import { useTranslations } from 'next-intl';

export type V4EntdeckenMode = 'list' | 'smart';

interface V4EntdeckenTabsProps {
  current: V4EntdeckenMode;
  onChange: (next: V4EntdeckenMode) => void;
}

/** Stabile Mode-Keys; Anzeige-Labels kommen aus dem Discover-Namespace. */
const TABS: { key: V4EntdeckenMode; labelKey: 'tabList' | 'tabSmart' }[] = [
  { key: 'list',  labelKey: 'tabList' },
  { key: 'smart', labelKey: 'tabSmart' },
];

export function V4EntdeckenTabs({ current, onChange }: V4EntdeckenTabsProps) {
  const t = useTranslations('Discover');
  return (
    <div role="tablist" aria-label={t('tabsAria')} className="inline-flex p-1 rounded-full bg-[var(--v4-surface-elevated)] border border-[var(--v4-hairline-2)]">
      {TABS.map(tab => {
        const isActive = tab.key === current;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={
              'press-haptic px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ' +
              (isActive
                ? 'bg-[var(--v4-ink)] text-[#0a0a0c]'
                : 'text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]')
            }
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
