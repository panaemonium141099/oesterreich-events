import Link from 'next/link';
import { buildEntdeckenHref, type EntdeckenScope } from '@/lib/hubs/hub-links';

/**
 * The "search all events" bridge button on hub pages. Renders a real <a> to
 * the /entdecken explorer pre-scoped to this hub's place/region, so a visitor
 * who landed on the static SEO page can jump into the live filterable list
 * (and widen the scope to all of Austria from there).
 *
 * Server component on purpose: the link must be in the SSR HTML so it also
 * counts as an internal link from the hub into /entdecken.
 */
export function HubSearchCTA({
  scope,
  label,
}: {
  scope: EntdeckenScope;
  label: string;
}) {
  return (
    <Link
      href={buildEntdeckenHref(scope)}
      className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-semibold text-black hover:bg-white/90 transition-colors"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      {label}
    </Link>
  );
}
