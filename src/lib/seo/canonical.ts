/**
 * Canonical-URLs fuer die App-Router-Seiten.
 *
 * Warum es diese Datei gibt: `src/app/[locale]/layout.tsx` setzte einen
 * locale-weiten `alternates.canonical` ("https://lasstreffen.at" bzw.
 * ".../en"). Next.js merged Metadata von Layout und Page — eine Seite
 * OHNE eigenes `alternates` erbte damit den Layout-Canonical und sagte
 * Google "ich bin die Startseite". Live gemessen (2026-09-04):
 * /wien, /wien/musik und /studenten kanonisierten alle auf
 * https://lasstreffen.at, also ~420 Sitemap-URLs, die sich selbst
 * de-indexierten. Der Canonical gehoert deshalb in jede Seite, nie ins
 * Layout.
 *
 * Regel (bereits so in thema/[slug] und gemeinde/[slug] umgesetzt):
 * der Canonical ist IMMER die deutsche, praefixlose URL. Eine
 * /en-Route zeigt so lange auf ihr deutsches Original, wie sie
 * deutschen Content rendert — erst wenn eine Seite echte EN-Texte hat,
 * bekommt sie via `bilingualAlternates()` einen eigenen /en-Canonical
 * plus hreflang (so macht es events/[...slug] anhand von `title_en`).
 */

export const SITE_URL = 'https://lasstreffen.at';

/**
 * `alternates`-Block fuer eine Seite, die nur auf Deutsch existiert.
 * `path` ist der praefixlose Pfad mit fuehrendem Slash ('' = Startseite).
 */
export function deOnlyAlternates(path: string): { canonical: string } {
  return { canonical: `${SITE_URL}${path}` };
}

/**
 * `alternates`-Block fuer eine Seite, die in beiden Sprachen echten
 * Content hat: jede Sprachvariante kanonisiert auf sich selbst und
 * verweist per hreflang auf die andere.
 */
export function bilingualAlternates(path: string, locale: string) {
  const de = `${SITE_URL}${path}`;
  const en = `${SITE_URL}/en${path}`;
  return {
    canonical: locale === 'en' ? en : de,
    languages: {
      'de-AT': de,
      en,
      'x-default': de,
    },
  };
}
