import Link from 'next/link';
import { CITY_HUB_LINKS, BUNDESLAND_HUB_LINKS } from '@/lib/hubs/hub-directory';

/**
 * Landing-page "Veranstaltungen nach Stadt & Region" block (bottom of /).
 *
 * Re-introduces the region discoverability the v4 refactor dropped and feeds
 * internal links into the city + bundesland hubs — the link equity those hubs
 * need to climb (GSC showed them stuck on page 4-5 with nothing linking in).
 */
export function RegionHubsSection() {
  return (
    <section className="mx-auto w-full max-w-[1180px] px-4 md:px-14 py-14">
      <h2 className="text-2xl md:text-3xl font-bold text-[var(--v4-ink)] mb-2">
        Veranstaltungen nach Stadt &amp; Region
      </h2>
      <p className="text-[var(--v4-ink)]/60 mb-7 max-w-2xl">
        Spring direkt in deine Stadt oder dein Bundesland — und durchsuche von
        dort aus ganz Österreich.
      </p>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--v4-ink)]/50 mb-3">
        Städte
      </h3>
      <div className="flex flex-wrap gap-2 mb-8">
        {CITY_HUB_LINKS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-full border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)] px-4 py-2 text-sm font-medium text-[var(--v4-ink)] transition-colors"
          >
            {c.name}
          </Link>
        ))}
      </div>

      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--v4-ink)]/50 mb-3">
        Bundesländer
      </h3>
      <div className="flex flex-wrap gap-2">
        {BUNDESLAND_HUB_LINKS.map((b) => (
          <Link
            key={b.href}
            href={b.href}
            className="rounded-full border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-3)] px-4 py-2 text-sm font-medium text-[var(--v4-ink)] transition-colors"
          >
            {b.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
