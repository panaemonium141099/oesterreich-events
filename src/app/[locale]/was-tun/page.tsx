/**
 * `/was-tun` — Einstieg der Seiten „Was kann man in X machen?": alle
 * Bundesländer und Tourismusregionen als Links. Rein statisch (keine
 * Abfrage); die Gemeinden hängen an ihren Bundesland-Seiten.
 */

import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { Link as LocaleLink } from '@/i18n/navigation';
import { deOnlyAlternates } from '@/lib/seo/canonical';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { bundeslandLinks, regionLinks, WAS_TUN_BASE, type WasTunLink } from '@/lib/was-tun/places';

export const revalidate = 86400;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

const TITLE = 'Was kann man in Österreich machen? Alle Orte und Regionen';
const DESCRIPTION =
  'Events, Ausflugsziele und Freizeitaktivitäten für jede Gemeinde, jede Tourismusregion und jedes Bundesland in Österreich.';

export function generateMetadata(): Metadata {
  const alternates = deOnlyAlternates(WAS_TUN_BASE);
  return {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates,
    openGraph: { title: TITLE, description: DESCRIPTION, type: 'website', url: alternates.canonical },
  };
}

function Chips({ links }: { links: WasTunLink[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <LocaleLink
          key={l.href}
          href={l.href}
          className="rounded-full border border-[var(--v4-hairline-3)] hover:border-[var(--v4-hairline-4)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--v4-ink)] transition-colors"
        >
          {l.name}
        </LocaleLink>
      ))}
    </div>
  );
}

const H2 = 'm-0 mb-4 text-[21px] font-extrabold tracking-[-0.03em] text-[var(--v4-ink)]';

export default async function WasTunIndexPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  setRequestLocale(hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale);

  const bundeslaender = BUNDESLAENDER.filter((b) => b.id !== 'all');

  return (
    <main className="min-h-screen bg-[var(--v4-surface)] text-[var(--v4-ink)]">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 pt-6 md:pt-8 pb-20">
        <header className="mb-10">
          <h1 className="m-0 text-[30px] md:text-[40px] font-extrabold tracking-[-0.035em] leading-[1.08]">
            Was kann man in Österreich machen?
          </h1>
          <p className="mt-4 mb-0 text-[var(--v4-ink-70)] leading-relaxed max-w-2xl">
            Wähle ein Bundesland oder eine Region. Jede Seite zeigt Veranstaltungen, Ausflugsziele und
            Freizeitaktivitäten gemischt in einer Liste, die Gemeinden findest du auf der Seite ihres Bundeslands.
          </p>
        </header>

        <section className="mb-12">
          <h2 className={H2}>Bundesländer</h2>
          <Chips links={bundeslandLinks()} />
        </section>

        <section>
          <h2 className={H2}>Regionen</h2>
          {bundeslaender.map((b) => {
            const links = regionLinks(b.id);
            if (links.length === 0) return null;
            return (
              <div key={b.id} className="mb-8">
                <h3 className="m-0 mb-3 text-[15px] font-bold text-[var(--v4-ink-70)]">{b.name}</h3>
                <Chips links={links} />
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
