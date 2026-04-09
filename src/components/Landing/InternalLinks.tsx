import Link from 'next/link';

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
    <nav className="mt-10 pt-8 border-t border-white/10 space-y-6">
      {groups.map((group) => (
        <div key={group.title}>
          <h3 className="text-sm font-medium text-white/60 mb-2">
            {group.title}
          </h3>
          <div className="flex flex-wrap gap-2">
            {group.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full border border-white/10 transition-colors"
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
