import { defineRouting } from 'next-intl/routing';

/**
 * fn-17 i18n-Routing — die zentralen Entscheidungen:
 *
 * - `localePrefix: 'as-needed'`: Deutsche URLs bleiben EXAKT wie vor der
 *   i18n-Einführung (kein /de-Präfix, keine Redirects). Nur Englisch
 *   bekommt das /en-Präfix. Bestehende Google-Rankings, geteilte Links
 *   und gedruckte QR-Codes bleiben dadurch gültig.
 *
 * - `localeDetection: false` + `localeCookie: false`: Die Sprache kommt
 *   AUSSCHLIESSLICH aus der URL. Kein Accept-Language-Redirect (Google-
 *   Guideline: nie per Header/IP zwangsumleiten) und vor allem KEIN
 *   Set-Cookie für anonyme Besucher — src/middleware.ts hält anonyme
 *   Requests bewusst cookie-frei, damit ISR/Prerendering greift (GSC-
 *   Vorfall 2026-04: Set-Cookie → `Cache-Control: private` → Google
 *   deindexiert). Ein NEXT_LOCALE-Cookie würde das wieder einführen.
 *
 * Neue Sprache hinzufügen = Eintrag in `locales` + messages/<lang>.json.
 */
export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: false,
});

export type AppLocale = (typeof routing.locales)[number];
