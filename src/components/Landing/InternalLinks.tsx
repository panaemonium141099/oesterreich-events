import { Link } from '@/i18n/navigation';

export interface LinkGroup {
  title: string;
  links: { label: string; href: string }[];
}

interface InternalLinksProps {
  groups: LinkGroup[];
}

/**
 * Internal link section at the bottom of landing pages.
 * Groups links by category (e.g., "Mehr in Wien", "Andere Regionen", "Stadte").
 */
export function InternalLinks({ groups }: InternalLinksProps) {
  if (groups.length === 0) return null;

  return (
    <nav className="mt-12 pt-8 border-t border-[var(--v4-hairline-2)] space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="text-[13px] font-bold text-[var(--v4-ink-70)] mb-2.5">
            {group.title}
          </h3>
          <div className="flex flex-wrap gap-2">
            {group.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[12.5px] font-medium text-[var(--v4-ink-50)] hover:text-[var(--v4-ink)] px-3 py-1.5 rounded-full border border-[var(--v4-hairline-2)] hover:border-[var(--v4-hairline-4)] transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
