import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import { loadMessages } from './messages';
import { getSite } from '@/lib/site';

/**
 * Server-seitige Message-Auflösung pro Request. Der `locale`-Wert kommt
 * aus dem [locale]-Routensegment (via Middleware-Rewrite); alles
 * Unbekannte fällt auf Deutsch zurück.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // fn-31: Basis plus Überlagerung der Seite (für lasstreffen.at die Basis).
    messages: await loadMessages(locale, getSite()),
  };
});
