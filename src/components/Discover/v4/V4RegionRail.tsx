import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CITY_HUB_LINKS, BUNDESLAND_HUB_LINKS } from '@/lib/hubs/hub-directory';

/**
 * Horizontal "Nach Region" rail on /entdecken list mode. Links to the city +
 * bundesland hub pages so the explorer is an entry point INTO the SEO hubs
 * (and vice-versa via HubSearchCTA) — the two halves of the hybrid loop.
 *
 * Pure links, so it stays cheap inside the client list-mode tree.
 */
export function V4RegionRail() {
  const t = useTranslations('Discover');
  const hubs = [...CITY_HUB_LINKS, ...BUNDESLAND_HUB_LINKS];
  return (
    <nav aria-label={t('regionRailAria')} className="mb-5">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="shrink-0 pr-1 text-[12px] font-semibold text-[var(--v4-ink)]/50">
          {t('regionRail')}
        </span>
        {hubs.map((h) => (
          <Link
            key={h.href}
            href={h.href}
            className="shrink-0 rounded-full border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)] px-3 py-1.5 text-[13px] font-medium text-[var(--v4-ink)] transition-colors"
          >
            {h.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
