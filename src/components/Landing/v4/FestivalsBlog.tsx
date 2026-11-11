/**
 * „Festivals" und „Aus dem Blog" nebeneinander (fn-30.6, Mockup D `.duo`):
 * zwei Listen mit 92×64-Bild, Titel und zwei Zeilen Kleingedrucktem.
 * Festivals: Zeitraum · Ort, darunter bis zu drei Acts; Blog: Kategorie ·
 * Datum. Unter 768 px stehen die Listen untereinander. Server-Komponente.
 *
 * Festival-Bilder kommen von beliebigen Veranstalter-Websites, deshalb ein
 * einfaches <img> statt next/image (keine Host-Freigabe nötig); Blog-Bilder
 * liegen im Projekt und gehen über next/image.
 */

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { LandingFestival } from '@/lib/v4/get-landing-data';
import type { LandingPost } from '@/lib/v4/landing-picks';
import { dayRangeLabel, shortDateWithYear } from '@/lib/landing/day-labels';

const ROW = 'press-haptic grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3.5 border-t border-[var(--v4-hairline-2)] py-2.5 first:border-t-0';
const IMG = 'h-16 w-[92px] rounded-[10px] object-cover';

function Head({ title, href, all, testId }: { title: string; href: string; all: string; testId: string }) {
  return (
    <div className="mb-2 flex items-baseline gap-3">
      <h2 className="m-0 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]">{title}</h2>
      <Link href={href} className="press-haptic ml-auto whitespace-nowrap text-[13px] font-bold text-[var(--v4-ink-70)] hover:text-[var(--v4-ink)]" data-testid={testId}>
        {all} ›
      </Link>
    </div>
  );
}

export function FestivalsBlog({ festivals, posts }: { festivals: LandingFestival[]; posts: LandingPost[] }) {
  const t = useTranslations('Landing.FestivalsBlog');
  const tShelves = useTranslations('Landing.Shelves');
  const locale = useLocale();
  if (festivals.length === 0 && posts.length === 0) return null;
  const join = (from: string, to: string) => tShelves('range', { from, to });

  return (
    <section className="mt-10 grid gap-7 md:grid-cols-2 md:gap-10 [&>*]:min-w-0" data-testid="festivals-blog">
      {festivals.length > 0 && (
        <div data-testid="festivals-column">
          <Head title={t('festivals')} href="/festivals" all={t('allFestivals')} testId="festivals-all"/>
          {festivals.map(f => {
            const when = dayRangeLabel(f.starts_at, f.ends_at, locale, join);
            const meta = [when, f.city].filter(Boolean).join(' · ');
            return (
              <Link key={f.id} href={`/festivals/${f.slug}`} className={ROW} data-track="landing_festival_click" data-track-id={f.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Veranstalter-Bild von beliebigem Host */}
                <img src={f.image_url ?? '/images/categories/musik-1.jpg'} alt="" loading="lazy" width={92} height={64} className={IMG}/>
                <span>
                  <b className="block text-[14.5px] font-bold leading-[1.25] tracking-[-0.01em] text-[var(--v4-ink)]">{f.canonical_name}</b>
                  {meta && <small className="mt-0.5 block text-[12.5px] text-[var(--v4-ink-50)]">{meta}</small>}
                  {f.acts.length > 0 && (
                    <small className="mt-0.5 block text-[12.5px] text-[var(--v4-ink-70)]">{f.acts.join(', ')}</small>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
      {posts.length > 0 && (
        <div data-testid="blog-column">
          <Head title={t('blog')} href="/blog" all={t('allPosts')} testId="blog-all"/>
          {posts.map(p => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className={ROW} data-track="landing_post_click" data-track-id={p.slug}>
              <Image src={p.image} alt="" width={92} height={64} sizes="92px" className={IMG}/>
              <span>
                <b className="block text-[14.5px] font-bold leading-[1.25] tracking-[-0.01em] text-[var(--v4-ink)]">{p.title}</b>
                <small className="mt-0.5 block text-[12.5px] text-[var(--v4-ink-50)]">
                  {[p.category, shortDateWithYear(p.publishDate, locale)].filter(Boolean).join(' · ')}
                </small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
