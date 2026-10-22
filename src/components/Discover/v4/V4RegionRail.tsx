import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { CITY_HUB_LINKS, BUNDESLAND_HUB_LINKS } from '@/lib/hubs/hub-directory';

/**
 * Chip-Reihe unter dem Kopf von /entdecken: Wien und die fünf Stadt-Hubs
 * als Einstieg in die SEO-Hubs (die neun Bundesländer bekommen im Regal
 * „Nach Region" Bildkacheln). Reine Links, bleibt im Client-Baum billig.
 */
export function V4RegionRail() {
  const t = useTranslations('Discover');
  const wien = BUNDESLAND_HUB_LINKS.find((h) => h.href === '/wien');
  const hubs = wien ? [wien, ...CITY_HUB_LINKS] : CITY_HUB_LINKS;
  return (
    <nav aria-label={t('regionRailAria')} className="mb-6">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 thin-scroll">
        <span className="shrink-0 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] px-3.5 py-1.5 text-[13px] font-semibold" aria-current="true">
          {t('scopeAllChip')}
        </span>
        {hubs.map((h) => (
          <Link
            key={h.href}
            href={h.href}
            className="shrink-0 rounded-full border border-[var(--v4-hairline-3)] hover:border-[var(--v4-hairline-4)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--v4-ink)] transition-colors"
          >
            {h.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}
