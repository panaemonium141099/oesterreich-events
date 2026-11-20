/**
 * „Was kann man in X bei Regen machen?" — `/was-tun/{slug}/{thema}`
 *
 * Jedes Thema aus src/lib/was-tun/themes.ts gibt es für jeden Ort; die
 * Seite ist dieselbe Ansicht wie die Grundseite, nur mit den Filtern des
 * Themas. Ein neues Thema ist eine Zeile in themes.ts.
 *
 * ISR ohne Vorab-Build. Unter drei Einträgen noindex, damit ein Thema ohne
 * Bestand in einem kleinen Ort nicht im Index landet.
 */

import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { resolveWasTunPlace, wasTunHref, wasTunRedirectSlug } from '@/lib/was-tun/places';
import { wasTunThemeBySlug } from '@/lib/was-tun/themes';
import { WasTunView, wasTunMetadata } from '@/components/WasTun/WasTunView';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; thema: string }>;
}): Promise<Metadata> {
  const { slug, thema } = await params;
  const place = resolveWasTunPlace(slug);
  const theme = wasTunThemeBySlug(thema);
  if (!place || !theme) return { title: 'Seite nicht gefunden' };
  return wasTunMetadata(place, theme);
}

export default async function WasTunThemePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; thema: string }>;
}) {
  const { locale: rawLocale, slug, thema } = await params;
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  setRequestLocale(locale);

  const theme = wasTunThemeBySlug(thema);
  if (!theme) notFound();

  const redirectSlug = wasTunRedirectSlug(slug);
  if (redirectSlug) {
    permanentRedirect(
      `${locale === routing.defaultLocale ? '' : `/${locale}`}${wasTunHref(redirectSlug, theme.slug)}`,
    );
  }
  const place = resolveWasTunPlace(slug);
  if (!place) notFound();

  return <WasTunView place={place} theme={theme} />;
}
