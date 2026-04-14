import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ALL_POSTS } from '@/content/blog';

export const metadata: Metadata = {
  title: '\u00d6sterreich Events Blog | Event-Guides & Tipps',
  description:
    'Event-Guides und Tipps zu den gr\u00f6\u00dften Festivals und Veranstaltungen in \u00d6sterreich. Termine, Lineups, Anreise und Insiderwissen f\u00fcr Wien, Salzburg, Graz und alle Bundesl\u00e4nder.',
  openGraph: {
    title: '\u00d6sterreich Events Blog | Event-Guides & Tipps',
    description:
      'Event-Guides und Tipps zu den gr\u00f6\u00dften Festivals und Veranstaltungen in \u00d6sterreich.',
    type: 'website',
  },
  alternates: {
    canonical: 'https://lasstreffen.at/blog',
    languages: {
      'de-AT': 'https://lasstreffen.at/blog',
      'x-default': 'https://lasstreffen.at/blog',
    },
  },
};

// ── Category filter ──────────────────────────────────────────────────────────
//
// The spec calls for tabs: "Alle, Musik, Kultur, Märkte, Sport, Brauchtum, Klassik".
// The actual category strings stored on FestivalPost objects are compound (e.g.
// "Musik & Festival", "Kultur & Tradition"). The mapping below translates each
// spec tab to the exact stored category strings that belong in that group.
// This is intentional — no posts carry bare "Märkte" or "Brauchtum" strings;
// each spec label is a display-layer concept that groups multiple stored values.
//
// Stored values (as of T1-T6): Musik | Musik & Festival | Musik & Konzerte |
//   Kultur & Tradition | Kultur & Bühne | Kulinarik & Tradition | Essen & Trinken |
//   Sport & Outdoor | Sport & Fitness | Festivals | Festivals & Feste | Open-Air & Feste
const FILTER_TABS: Array<{
  label: string;
  /** The ?category= URL param value — matches the spec label exactly. */
  query: string;
  /** Exact stored `category` values that belong to this tab. null = show all. */
  matchValues: string[] | null;
}> = [
  { label: 'Alle',         query: 'Alle',      matchValues: null },
  {
    label: 'Musik',
    query: 'Musik',
    matchValues: ['Musik', 'Musik & Festival', 'Musik & Konzerte'],
  },
  {
    label: 'Kultur',
    query: 'Kultur',
    matchValues: ['Kultur & Tradition', 'Kultur & B\u00fchne'],
  },
  {
    label: 'M\u00e4rkte',
    query: 'M\u00e4rkte',
    // Posts about markets, food festivals, and culinary traditions
    matchValues: ['Kulinarik & Tradition', 'Essen & Trinken'],
  },
  {
    label: 'Sport',
    query: 'Sport',
    matchValues: ['Sport & Outdoor', 'Sport & Fitness'],
  },
  {
    label: 'Brauchtum',
    query: 'Brauchtum',
    // Folk customs, traditional festivals, and local festive culture
    matchValues: ['Kultur & Tradition', 'Festivals & Feste', 'Open-Air & Feste'],
  },
  {
    label: 'Klassik',
    query: 'Klassik',
    // Classical music: opera, chamber music, and concert events
    matchValues: ['Musik & Konzerte'],
  },
];

function matchesFilter(category: string, matchValues: string[] | null): boolean {
  if (matchValues === null) return true;
  return matchValues.includes(category);
}

function ArrowRight() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface BlogPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { category } = await searchParams;

  // Determine the active tab (default to 'Alle').
  // The spec uses ?category=Märkte etc. — URL-decoded values match tab queries directly.
  const activeQuery =
    category && FILTER_TABS.some(t => t.query === category) ? category : 'Alle';

  const activeTab = FILTER_TABS.find(t => t.query === activeQuery) ?? FILTER_TABS[0];

  const filteredPosts = ALL_POSTS.filter(p =>
    matchesFilter(p.category, activeTab.matchValues)
  );

  const [hero, ...rest] = filteredPosts;

  // BreadcrumbList schema
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lasstreffen.at' },
      { '@type': 'ListItem', position: 2, name: 'Blog' },
    ],
  };

  // ItemList schema — helps Google understand the blog listing
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Österreich Events Blog',
    description: 'Event-Guides und Tipps zu den größten Festivals und Veranstaltungen in Österreich.',
    url: 'https://lasstreffen.at/blog',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: ALL_POSTS.length,
      itemListElement: ALL_POSTS.slice(0, 20).map((post, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://lasstreffen.at/blog/${post.slug}`,
        name: post.title,
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd).replace(/</g, '\u003c') }}
      />
    <div className="min-h-screen bg-[#f8f6f2]">

      {/* TOP NAV */}
      <nav className="border-b border-gray-200 bg-[#f8f6f2]/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors tracking-tight">
            LassTreffen.at
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
            Blog
          </span>
          <Link
            href="/map"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors group"
          >
            Events entdecken
            <ArrowRight />
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-14">

        {/* PAGE HEADER */}
        <header className="mb-10">
          <div className="flex items-center gap-4 mb-5">
            <div className="h-px w-8 bg-gray-400" />
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
              2026
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-[1.05] mb-4">
            {'\u00d6sterreich'}
            <br />
            Events Blog
          </h1>
          <p className="text-gray-500 text-xl font-light max-w-lg leading-relaxed">
            Event-Guides, Tipps und Insiderwissen zu den größten Veranstaltungen Österreichs.
          </p>
        </header>

        {/* CATEGORY FILTER TABS */}
        <nav aria-label="Kategorie-Filter" className="mb-12">
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map(tab => (
              <Link
                key={tab.query}
                href={tab.query === 'Alle' ? '/blog' : `/blog?category=${encodeURIComponent(tab.query)}`}
                className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
                  activeQuery === tab.query
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            {filteredPosts.length}{' '}
            {filteredPosts.length === 1 ? 'Beitrag' : 'Beitr\u00e4ge'}
            {activeTab.query !== 'Alle' ? ` in ${activeTab.label}` : ' gesamt'}
          </p>
        </nav>

        {filteredPosts.length === 0 ? (
          <p className="text-gray-400 text-center py-24 text-lg">
            Keine Beitr\u00e4ge in dieser Kategorie gefunden.
          </p>
        ) : (
          <>
            {/* HERO ARTICLE (first post) */}
            {hero && (
              <article className="group mb-12">
                <Link href={`/blog/${hero.slug}`} className="block">
                  <div className="grid md:grid-cols-2 gap-8 items-center">
                    {/* Image */}
                    <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
                      <Image
                        src={hero.thumbnailImage ?? hero.heroImage}
                        alt={hero.title}
                        fill
                        priority
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    </div>

                    {/* Text */}
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 border border-gray-300 px-2.5 py-1">
                          {hero.category}
                        </span>
                        <span className="text-gray-400 text-xs uppercase tracking-wider">
                          Featured
                        </span>
                      </div>

                      <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-3 group-hover:text-gray-600 transition-colors">
                        {hero.title}
                      </h2>

                      <p className="text-gray-500 text-base leading-relaxed mb-5 line-clamp-3">
                        {hero.excerpt}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-400 uppercase tracking-wider mb-6">
                        <span>{hero.keyFacts.dates}</span>
                        <span>—</span>
                        <span>{hero.keyFacts.location}</span>
                      </div>

                      <span className="inline-flex items-center gap-2 text-gray-900 font-semibold text-sm border-b border-gray-900 pb-0.5 group-hover:border-gray-400 group-hover:text-gray-500 transition-colors">
                        Artikel lesen
                        <ArrowRight />
                      </span>
                    </div>
                  </div>
                </Link>
              </article>
            )}

            {/* DIVIDER */}
            {rest.length > 0 && <div className="border-t border-gray-200 mb-12" />}

            {/* REMAINING ARTICLES GRID */}
            <div className="grid md:grid-cols-2 gap-8">
              {rest.map(post => (
                <article key={post.slug} className="group">
                  <Link href={`/blog/${post.slug}`} className="block">
                    {/* Image */}
                    <div className="relative aspect-[16/9] overflow-hidden rounded-xl mb-5">
                      <Image
                        src={post.thumbnailImage ?? post.heroImage}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 40vw"
                      />
                    </div>

                    {/* Category badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 border border-gray-300 px-2.5 py-1">
                        {post.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-tight mb-2 group-hover:text-gray-600 transition-colors">
                      {post.title}
                    </h2>

                    <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">
                      {post.excerpt}
                    </p>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 uppercase tracking-wider">
                        {post.keyFacts.dates} — {post.keyFacts.location}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-gray-900 text-sm font-medium group-hover:text-gray-500 transition-colors">
                        Weiterlesen
                        <ArrowRight />
                      </span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </>
        )}

        {/* FOOTER */}
        <div className="mt-16 pt-8 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <p className="text-gray-400 text-xs uppercase tracking-wider">
            LassTreffen.at — Österreich Events
          </p>
          <Link
            href="/map"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors group"
          >
            Alle Events auf der Karte
            <ArrowRight />
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
