import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getPostBySlug, getPostsByCategory, ALL_POSTS } from '@/content/blog';
import { AdSlot } from '@/components/Ads/AdSlot';

export function generateStaticParams() {
  return ALL_POSTS.map(p => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Nicht gefunden' };

  return {
    // `absolute` bypasses the root layout's `%s | LassTreffen.at` template.
    // Blog SEO titles already include the full marketing phrasing we want
    // indexed, and letting the template append " | LassTreffen.at" on top
    // pushes every post past Bing's 60-char title warning.
    title: { absolute: post.seoTitle },
    description: post.seoDescription,
    keywords: post.keywords,
    alternates: {
      canonical: `https://lasstreffen.at/blog/${slug}`,
      languages: {
        'de-AT': `https://lasstreffen.at/blog/${slug}`,
        'x-default': `https://lasstreffen.at/blog/${slug}`,
      },
    },
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      type: 'article',
      publishedTime: post.publishDate,
      modifiedTime: post.updatedDate,
      section: post.category,
      tags: post.keywords,
      authors: ['https://lasstreffen.at'],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seoTitle,
      description: post.seoDescription,
    },
  };
}

// ── SVG Icon components (no emoji) ──────────────────────────────────────────

function IconTrain() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0">
      <rect x="3" y="3" width="14" height="10" rx="2" />
      <path d="M3 10h14M7 16l-1.5 2M13 16l1.5 2M10 16v2" strokeLinecap="round" />
    </svg>
  );
}

function IconCar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0">
      <path d="M3 10l1.5-4h11L17 10v4H3v-4z" strokeLinejoin="round" />
      <circle cx="6" cy="15" r="1.5" />
      <circle cx="14" cy="15" r="1.5" />
    </svg>
  );
}

function IconTent() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0">
      <path d="M2 16L10 4l8 12H2z" strokeLinejoin="round" />
      <path d="M10 4v12" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0">
      <rect x="2" y="4" width="16" height="14" rx="2" />
      <path d="M6 2v4M14 2v4M2 9h16" strokeLinecap="round" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0">
      <rect x="2" y="5" width="16" height="12" rx="2" />
      <path d="M2 9h16" strokeLinecap="round" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0">
      <path d="M10 2a5 5 0 0 1 5 5c0 4-5 11-5 11S5 11 5 7a5 5 0 0 1 5-5z" />
      <circle cx="10" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 shrink-0">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 9v5M10 7v.5" strokeLinecap="round" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 shrink-0">
      <path d="M6 3H3v10h10v-3M9 3h4v4M13 3L7 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <path d="M13 8H3M7 4L3 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Map icon label to component
function PracticalIcon({ label }: { label: string }) {
  const l = label.toLowerCase();
  if (l.includes('bahn') || l.includes('zug') || l.includes('növog') || l.includes('westbahn')) return <IconTrain />;
  if (l.includes('auto') || l.includes('pkw')) return <IconCar />;
  if (l.includes('camping') || l.includes('zelt')) return <IconTent />;
  if (l.includes('ticket') || l.includes('kauf') || l.includes('cash')) return <IconCard />;
  if (l.includes('wetter') || l.includes('datum') || l.includes('wann') || l.includes('pack')) return <IconCalendar />;
  return <IconPin />;
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  // BreadcrumbList schema — helps Google display navigation path
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lasstreffen.at' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://lasstreffen.at/blog' },
      { '@type': 'ListItem', position: 3, name: post.title },
    ],
  };

  // BlogPosting schema — describes the article itself
  const blogPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription,
    image: post.heroImage,
    datePublished: post.publishDate,
    dateModified: post.updatedDate,
    author: { '@type': 'Organization', name: 'LassTreffen.at', url: 'https://lasstreffen.at' },
    publisher: { '@type': 'Organization', name: 'LassTreffen.at', url: 'https://lasstreffen.at' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://lasstreffen.at/blog/${slug}` },
  };

  // Standalone Event schema — satisfies Google's Event rich-result requirements.
  // `eventStatus`, `eventAttendanceMode`, `performer` and `offers` are all
  // emitted unconditionally so the page never triggers "fehlende Felder"
  // warnings in Search Console (rich-results gate).
  const priceLower = post.keyFacts.price.toLowerCase();
  const isFree = priceLower.includes('frei') || priceLower.includes('gratis') || priceLower.includes('kostenlos');
  const priceMatch = post.keyFacts.price.match(/(\d+(?:[.,]\d+)?)/);
  const parsedPrice = isFree ? '0' : priceMatch ? priceMatch[1].replace(',', '.') : null;

  // Performers — derive from lineup headliners when available, otherwise
  // treat the festival itself as the performing entity so the field is
  // never missing. If the lineup consists only of support acts, fall back
  // to the full list so we still emit a non-empty performer array.
  const headliners = post.lineup?.filter(act => act.role === 'headliner' || !act.role) ?? [];
  const performerSource = headliners.length > 0 ? headliners : (post.lineup ?? []);
  const performers = performerSource.length > 0
    ? performerSource.slice(0, 12).map(act => ({
        '@type': 'PerformingGroup',
        name: act.name,
      }))
    : [{ '@type': 'PerformingGroup', name: post.jsonLdEvent.name }];

  const offers: Record<string, unknown> = {
    '@type': 'Offer',
    url: post.keyFacts.website || post.jsonLdEvent.url,
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
    validFrom: post.publishDate,
  };
  if (parsedPrice != null) offers.price = parsedPrice;
  if (post.keyFacts.price) offers.name = post.keyFacts.price;

  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: post.jsonLdEvent.name,
    startDate: post.jsonLdEvent.startDate,
    endDate: post.jsonLdEvent.endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: post.jsonLdEvent.location,
      address: {
        '@type': 'PostalAddress',
        streetAddress: post.keyFacts.address,
        addressCountry: post.jsonLdEvent.addressCountry,
      },
    },
    image: post.jsonLdEvent.image,
    url: post.jsonLdEvent.url,
    description: post.jsonLdEvent.description,
    isAccessibleForFree: isFree,
    organizer: { '@type': 'Organization', name: 'LassTreffen.at', url: 'https://lasstreffen.at' },
    performer: performers,
    offers,
  };

  // FAQPage schema — enables FAQ rich results in Google
  const faqJsonLd = post.faqs && post.faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  } : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd).replace(/</g, '\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd).replace(/</g, '\u003c') }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\u003c') }}
        />
      )}

      <article className="min-h-screen bg-[#f8f6f2] text-gray-900">

        {/* ── HERO ── */}
        <div className="relative w-full h-[75vh] min-h-[420px] max-h-[700px] overflow-hidden">
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/80" />

          {/* Back nav */}
          <div className="absolute top-8 left-8 z-10">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium transition-colors group"
            >
              <IconArrowLeft />
              <span className="group-hover:underline underline-offset-2">Alle Artikel</span>
            </Link>
          </div>

          {/* Hero text */}
          <div className="absolute bottom-0 left-0 right-0 px-8 py-10 md:px-16 md:py-14">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 border border-white/30 px-3 py-1">
                  {post.category}
                </span>
                <span className="text-white/45 text-xs uppercase tracking-wider">
                  {post.readingTime} Min. Lesezeit
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-[1.05] tracking-tight mb-3">
                {post.title}
              </h1>
              <p className="text-white/65 text-lg md:text-xl font-light max-w-2xl leading-snug">
                {post.subtitle}
              </p>
              <div className="flex items-center gap-3 mt-5 text-white/40 text-xs uppercase tracking-wider">
                <span>{post.keyFacts.dates}</span>
                <span>—</span>
                <span>{post.keyFacts.location}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="max-w-2xl mx-auto px-6 py-14 md:py-20">

          {/* Lead paragraph */}
          <p className="text-xl md:text-2xl text-gray-700 font-light leading-relaxed mb-14 border-l-2 border-gray-300 pl-6">
            {post.intro}
          </p>

          {/* Ad: after lead */}
          <AdSlot slot="after-lead" format="auto" className="mb-14" />

          {/* Key Facts */}
          <div className="mb-14 border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                Auf einen Blick
              </p>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              {[
                { label: 'Datum', value: post.keyFacts.dates },
                { label: 'Ort', value: post.keyFacts.location },
                { label: 'Genre', value: post.keyFacts.genre },
                { label: 'Eintritt', value: post.keyFacts.price },
                ...(post.keyFacts.capacity ? [{ label: 'Kapazität', value: post.keyFacts.capacity }] : []),
                ...(post.keyFacts.since ? [{ label: 'Festival seit', value: post.keyFacts.since }] : []),
              ].map((item, i) => (
                <div key={i} className="px-6 py-4">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1">
                    {item.label}
                  </dt>
                  <dd className="text-gray-900 font-medium text-sm leading-snug">{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50">
              <a
                href={post.keyFacts.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors group"
              >
                Offizielle Website
                <IconExternal />
              </a>
            </div>
          </div>

          {/* History */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-5">
              {post.historyTitle}
            </h2>
            <p className="text-gray-600 leading-relaxed text-lg">{post.history}</p>
          </section>

          {/* Lineup */}
          {post.lineup && post.lineup.length > 0 && (
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
                {post.lineupTitle ?? 'Lineup'} {post.title}
              </h2>
              {post.lineupNote && (
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-6 flex items-center gap-2">
                  <IconInfo />
                  {post.lineupNote}
                </p>
              )}

              {/* Headliners */}
              <div className="mb-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">
                  {post.lineupTitle ? 'Highlights' : 'Headliner'}
                </p>
                <div className="divide-y divide-gray-100 border-y border-gray-100">
                  {post.lineup
                    .filter(a => a.role === 'headliner')
                    .map((act, i) => (
                      <div key={i} className="flex items-center justify-between py-3.5">
                        <span className="font-bold text-gray-900 text-base">{act.name}</span>
                        {act.day && (
                          <span className="text-gray-400 text-xs uppercase tracking-wider">
                            {act.day}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              {/* Support Acts */}
              {post.lineup.some(a => a.role === 'support') && (
                <div className="mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">
                    {post.lineupTitle ? 'Weiteres Programm' : 'Weitere Acts'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.lineup
                      .filter(a => a.role === 'support' || a.role === 'special')
                      .map((act, i) => (
                        <span
                          key={i}
                          className="text-sm font-medium text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg"
                        >
                          {act.name}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Gallery (only if images exist) */}
          {post.gallery.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-14 -mx-6 md:mx-0 md:rounded-xl overflow-hidden">
              {post.gallery.map((img, i) => (
                <figure key={i} className="relative aspect-[4/3] overflow-hidden group">
                  <Image
                    src={img.src}
                    alt={img.alt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 33vw, 220px"
                  />
                </figure>
              ))}
            </div>
          )}

          {/* Ad: mid-content */}
          <AdSlot slot="mid-content" format="horizontal" className="mb-14" />

          {/* What to Expect */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-5">
              {post.whatToExpectTitle}
            </h2>
            <p className="text-gray-600 leading-relaxed text-lg mb-6">{post.whatToExpect}</p>
            <ul className="space-y-3">
              {post.whatToExpectList.map((item, i) => (
                <li key={i} className="flex items-start gap-4 text-gray-700">
                  <span className="flex-shrink-0 mt-1 w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Practical Info */}
          <section className="mb-16">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-6">
              {post.practicalInfoTitle}
            </h2>
            <div className="divide-y divide-gray-100 border-y border-gray-100">
              {post.practicalInfo.map((info, i) => (
                <div key={i} className="flex items-start gap-5 py-5">
                  <div className="mt-0.5 w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                    <PracticalIcon label={info.label} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm mb-0.5">{info.label}</p>
                    <p className="text-gray-500 text-sm leading-relaxed">{info.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ Section */}
          {post.faqs && post.faqs.length > 0 && (
            <section className="mb-16">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mb-6">
                Häufige Fragen
              </h2>
              <div className="divide-y divide-gray-100 border-y border-gray-100">
                {post.faqs.map((faq, i) => (
                  <details key={i} className="group py-5">
                    <summary className="flex items-start justify-between gap-4 cursor-pointer list-none font-semibold text-gray-900 text-sm leading-snug hover:text-gray-600 transition-colors [&::-webkit-details-marker]:hidden">
                      <span>{faq.question}</span>
                      <span className="mt-0.5 w-5 h-5 flex-shrink-0 text-gray-400 group-open:rotate-45 transition-transform duration-200">
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M10 4v12M4 10h12" strokeLinecap="round" />
                        </svg>
                      </span>
                    </summary>
                    <p className="mt-3 text-gray-500 text-sm leading-relaxed pr-8">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Ad: end-of-article */}
          <AdSlot slot="end-of-article" format="rectangle" className="mb-16" />

          {/* CTA */}
          <div className="border border-gray-200 rounded-xl p-8 text-center bg-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">
              Mehr entdecken
            </p>
            <p className="text-gray-900 font-bold text-xl mb-6 tracking-tight">
              Noch mehr Events in Österreich
            </p>
            <Link
              href={post.ctaLink}
              className="inline-flex items-center gap-2 bg-gray-900 text-white font-semibold px-7 py-3 rounded-lg hover:bg-gray-800 transition-colors text-sm group"
            >
              {post.ctaText}
              <IconArrowRight />
            </Link>
          </div>
        </div>

        {/* AEHNLICHE BEITRAEGE */}
        <RelatedPosts currentSlug={slug} category={post.category} />
      </article>
    </>
  );
}

// ── Related Posts section ────────────────────────────────────────────────────

function RelatedPosts({ currentSlug, category }: { currentSlug: string; category: string }) {
  const related = getPostsByCategory(category)
    .filter(p => p.slug !== currentSlug)
    .slice(0, 3);

  if (related.length === 0) return null;

  return (
    <section className="bg-gray-50 border-t border-gray-200 py-14">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="h-px w-8 bg-gray-400" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
            Ähnliche Beiträge
          </span>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {related.map(p => (
            <article key={p.slug} className="group">
              <Link href={`/blog/${p.slug}`} className="block">
                <div className="relative aspect-[16/9] overflow-hidden rounded-xl mb-4">
                  <Image
                    src={p.thumbnailImage ?? p.heroImage}
                    alt={p.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                </div>
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400 border border-gray-200 px-2 py-0.5 mb-2 inline-block">
                  {p.category}
                </span>
                <h3 className="font-extrabold text-gray-900 text-base leading-tight mb-1 group-hover:text-gray-600 transition-colors line-clamp-2">
                  {p.title}
                </h3>
                <p className="text-gray-400 text-xs uppercase tracking-wider">
                  {p.keyFacts.dates}
                </p>
              </Link>
            </article>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors group"
          >
            Alle Beiträge anzeigen
            <IconArrowRight />
          </Link>
        </div>
      </div>
    </section>
  );
}
