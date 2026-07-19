import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/Layout/AppShell';
import { routing, type AppLocale } from '@/i18n/routing';
import { localeAlternates } from '@/lib/i18n-seo';
// fn-15.6: map-only CSS (mapbox/leaflet markers, popups, MapV3 chrome,
// map-loading overlay) was extracted from globals.css and lives in
// src/app/map-scope.css. Importing it here means it only ships on
// `/map` (and child segments) — the landing/blog/event pages no
// longer carry ~10 KB of map styles in their critical CSS chunk.
import '../map-scope.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale: AppLocale = hasLocale(routing.locales, rawLocale)
    ? rawLocale
    : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'MetaMap' });
  const alternates = localeAlternates('/map', locale);

  return {
    title: t('title'),
    description: t('description'),
    alternates,
    openGraph: {
      title: t('ogTitle'),
      description: t('ogDescription'),
      type: 'website',
      url: alternates.canonical,
    },
  };
}

/**
 * /map — anonymously browsable map of all events with auth-aware
 * marker actions (save, RSVP from popup) plus a top-bar notification
 * bell.
 *
 * fn-15.5 round-13 (codex): the top-bar bell uses NotificationBell
 * which calls useNotifications() — so /map DOES need
 * NotificationsProvider after all. Reverted to <AppShell hideSocialNav>:
 * full provider stack + bell unread badge work, just no floating
 * bottom-nav (the map's own UI is bottom-heavy already). Mapbox
 * stays on /map (~480 KB chunk) by intent; fn-15.5's bundle goal was
 * to keep Mapbox out of `/`, not out of /map.
 */
export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <AppShell hideSocialNav>{children}</AppShell>;
}
