/**
 * „Was kann man in X machen?" — `/was-tun/{slug}`
 *
 * Eine Seite je Gemeinde, Tourismusregion und Bundesland. Sie beantwortet
 * die Frage aus dem Bestand und zeigt ihn GANZ: oben die Antwort, darunter
 * die Regale von /entdecken, dann alle Veranstaltungen und alle
 * Ausflugsziele je mit Gesamtzahl und Nachladen. Anlass: Search Console 08
 * bis 11/2026, 158 von 2,29 Mio. Impressionen bei „was kann man in X
 * machen"; die Event-Übersichten (/gemeinde, /{bundesland}) zielen auf
 * „Veranstaltungen X" und bleiben unverändert.
 *
 * - Ortsauflösung und Ortsliste: src/lib/was-tun/places.ts (+ regions.ts)
 * - Themen („bei Regen", „mit Kindern"): themes.ts, Route [thema]/page.tsx
 * - Texte, FAQ, JSON-LD: src/lib/was-tun/content.ts (pur, getestet)
 * - Abfragen: src/lib/was-tun/loaders.ts (gleiche Filter und Reihenfolge wie
 *   /api/events und /api/activities, damit Nachladen dieselbe Menge meint)
 * - Ansicht: src/components/WasTun/WasTunView.tsx
 *
 * ISR wie die Gemeinde-Übersicht: kein Vorab-Build, jede Seite rendert beim
 * ersten Aufruf und liegt dann eine Stunde im Cache. Unter drei Einträgen
 * noindex. Nur Deutsch; /en kanonisiert auf die deutsche URL.
 */

import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { resolveWasTunPlace, wasTunHref, wasTunRedirectSlug } from '@/lib/was-tun/places';
import { WasTunView, wasTunMetadata } from '@/components/WasTun/WasTunView';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  // Kein Vorab-Build (wie /gemeinde/[slug]): rund 2.200 Seiten mit je drei
  // Abfragen würden den Deploy an die Datenbank hängen.
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const place = resolveWasTunPlace(slug);
  if (!place) return { title: 'Ort nicht gefunden' };
  return wasTunMetadata(place, null);
}

export default async function WasTunPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  setRequestLocale(locale);

  const redirectSlug = wasTunRedirectSlug(slug);
  if (redirectSlug) {
    permanentRedirect(`${locale === routing.defaultLocale ? '' : `/${locale}`}${wasTunHref(redirectSlug)}`);
  }
  const place = resolveWasTunPlace(slug);
  if (!place) notFound();

  return <WasTunView place={place} theme={null} />;
}
