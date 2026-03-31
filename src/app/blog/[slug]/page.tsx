import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getFestivalBySlug, getAllFestivalSlugs } from '@/content/blog/festivals';

export function generateStaticParams() {
  return getAllFestivalSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getFestivalBySlug(slug);
  if (!post) return { title: 'Nicht gefunden' };

  return {
    title: post.seoTitle,
    description: post.seoDescription,
    keywords: post.keywords,
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      images: [{ url: post.heroImage, width: 1600, alt: post.title }],
      type: 'article',
      publishedTime: post.publishDate,
      modifiedTime: post.updatedDate,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.seoTitle,
      description: post.seoDescription,
      images: [post.heroImage],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getFestivalBySlug(slug);
  if (!post) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoDescription,
    image: post.heroImage,
    datePublished: post.publishDate,
    dateModified: post.updatedDate,
    author: {
      '@type': 'Organization',
      name: 'LassTreffen.at',
      url: 'https://lasstreffen.at',
    },
    publisher: {
      '@type': 'Organization',
      name: 'LassTreffen.at',
      url: 'https://lasstreffen.at',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://lasstreffen.at/blog/${slug}`,
    },
    about: {
      '@type': 'Event',
      name: post.jsonLdEvent.name,
      startDate: post.jsonLdEvent.startDate,
      endDate: post.jsonLdEvent.endDate,
      location: {
        '@type': 'Place',
        name: post.jsonLdEvent.location,
        address: post.keyFacts.address,
      },
      url: post.jsonLdEvent.url,
      description: post.jsonLdEvent.description,
      isAccessibleForFree: post.keyFacts.price.toLowerCase().includes('frei'),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\u003c'),
        }}
      />

      <article className="min-h-screen bg-gray-950 text-white">
        {/* ── Hero ── */}
        <div className="relative w-full h-[70vh] min-h-[400px] max-h-[680px] overflow-hidden">
          <Image
            src={post.heroImage}
            alt={post.title}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/90" />

          {/* Back nav */}
          <div className="absolute top-6 left-6 z-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors group"
            >
              <svg
                className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              LassTreffen.at
            </Link>
          </div>

          {/* Hero text */}
          <div className="absolute bottom-0 left-0 right-0 p-8 md:p-14 max-w-4xl">
            <span
              className={`inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4 ${post.categoryColor}`}
            >
              {post.category}
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight mb-3">
              {post.title}
            </h1>
            <p className="text-lg md:text-xl text-white/70 font-light max-w-2xl">
              {post.subtitle}
            </p>
            <div className="flex items-center gap-4 mt-4 text-white/50 text-sm">
              <span>📅 {post.keyFacts.dates}</span>
              <span>·</span>
              <span>📍 {post.keyFacts.location}</span>
              <span>·</span>
              <span>⏱ {post.readingTime} Min. Lesezeit</span>
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-3xl mx-auto px-6 py-14">

          {/* Intro */}
          <p className="text-xl md:text-2xl text-white/80 font-light leading-relaxed mb-12 border-l-4 border-white/20 pl-6">
            {post.intro}
          </p>

          {/* Key Facts Box */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-12">
            <h2 className="text-white font-bold text-lg mb-5 flex items-center gap-2">
              <span>📋</span> Auf einen Blick
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <dt className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Datum</dt>
                <dd className="text-white font-medium">{post.keyFacts.dates}</dd>
              </div>
              <div>
                <dt className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Ort</dt>
                <dd className="text-white font-medium">{post.keyFacts.location}</dd>
              </div>
              <div>
                <dt className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Genre</dt>
                <dd className="text-white font-medium">{post.keyFacts.genre}</dd>
              </div>
              <div>
                <dt className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Eintritt</dt>
                <dd className="text-white font-medium">{post.keyFacts.price}</dd>
              </div>
              {post.keyFacts.capacity && (
                <div>
                  <dt className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Kapazität</dt>
                  <dd className="text-white font-medium">{post.keyFacts.capacity}</dd>
                </div>
              )}
              {post.keyFacts.since && (
                <div>
                  <dt className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Seit</dt>
                  <dd className="text-white font-medium">{post.keyFacts.since}</dd>
                </div>
              )}
            </dl>
            <a
              href={post.keyFacts.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-5 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-colors"
            >
              🌐 Offizielle Website
              <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* History Section */}
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              {post.historyTitle}
            </h2>
            <p className="text-white/70 leading-relaxed text-lg">
              {post.history}
            </p>
          </section>

          {/* Gallery */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12 rounded-2xl overflow-hidden">
            {post.gallery.map((img, i) => (
              <figure key={i} className="relative aspect-[4/3] overflow-hidden group">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 640px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-end">
                  <figcaption className="text-white text-xs p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {img.caption}
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>

          {/* What to Expect */}
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              {post.whatToExpectTitle}
            </h2>
            <p className="text-white/70 leading-relaxed text-lg mb-6">
              {post.whatToExpect}
            </p>
            <ul className="space-y-3">
              {post.whatToExpectList.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-white/80">
                  <span className="mt-1 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white/60">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Practical Info */}
          <section className="mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">
              {post.practicalInfoTitle}
            </h2>
            <div className="space-y-4">
              {post.practicalInfo.map((info, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 bg-white/4 hover:bg-white/7 border border-white/8 rounded-2xl p-5 transition-colors"
                >
                  <span className="text-2xl flex-shrink-0 mt-0.5">{info.icon}</span>
                  <div>
                    <p className="text-white font-semibold text-sm mb-1">{info.label}</p>
                    <p className="text-white/60 text-sm leading-relaxed">{info.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="bg-gradient-to-r from-white/5 to-white/10 border border-white/15 rounded-2xl p-8 text-center">
            <p className="text-white/60 text-sm uppercase tracking-wider mb-2">Mehr entdecken</p>
            <p className="text-white font-bold text-xl mb-5">
              Noch mehr Events in Österreich?
            </p>
            <Link
              href={post.ctaLink}
              className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors text-sm"
            >
              {post.ctaText}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
