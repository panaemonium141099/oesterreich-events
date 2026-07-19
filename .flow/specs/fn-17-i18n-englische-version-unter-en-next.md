# i18n: Englische Version unter /en (next-intl)

## Goal & Context
lasstreffen.at zweisprachig (DE/EN), spaeter erweiterbar (HU/CZ/SK/NL/HR). Treiber:
(1) User-Toggle DE/EN, (2) QR-Codes fuer Tourismusbueros je Sprache (Sprache MUSS in der URL stehen),
(3) SEO: englische Seiten als eigene indexierbare URLs mit hreflang ("Google-Praesenz verdoppeln").

## Architecture
- next-intl mit `[locale]`-Segment, `localePrefix: 'as-needed'`:
  **DE-URLs bleiben exakt wie heute** (kein /de-Praefix, keine Redirects, Rankings/QR-Links bleiben gueltig),
  EN unter `/en/...`.
- **Kein Locale-Cookie, keine Accept-Language-Detection** (`localeDetection: false`, `localeCookie: false`):
  Locale kommt NUR aus der URL. Grund: src/middleware.ts hat den SEO-Bypass (kein Set-Cookie fuer
  anonyme Requests, sonst killt `Cache-Control: private` die Indexierung â€” GSC-Vorfall 2026-04).
  Ein NEXT_LOCALE-Cookie wuerde genau das wieder einfuehren.
- intl-Middleware wird in src/middleware.ts komponiert (Rewrite / -> /de intern, /en/* -> [locale]=en).
- Alle Page-Routen + @modal-Slot wandern unter src/app/[locale]/. Am Root bleiben: api/, sitemap.xml/,
  robots.ts, manifest.ts, icon/apple-icon/opengraph-image, llms-full.txt/.
- html lang={locale} im [locale]-Layout; NextIntlClientProvider; Messages in messages/de.json + en.json.
- Sprachumschalter als Dropdown im V4TopNav (gleiche Seite, andere Sprache; erweiterbar fuer Sprache 3+).
- Event-Content (Beschreibungen): Slice "Lazy-Translation" â€” bei erstem EN-View uebersetzen
  (Gemini Free Tier oder DeepL Free) und in Supabase cachen (`events.title_en`, `events.description_en`).
  Bis dahin zeigen EN-Seiten deutschen Event-Content mit EN-Chrome (akzeptiert).

## API Contracts
- URLs: `/` = DE, `/en` = EN Landing, `/en/map`, `/en/events/[...slug]`, etc.
- hreflang: jede lokalisierte Seite liefert `alternates.languages` (de -> kanonische DE-URL,
  en -> /en-URL, x-default -> DE).
- Sitemap (custom route sitemap.xml/route.ts): pro URL `<xhtml:link rel="alternate" hreflang>`-Eintraege.
- QR-Links Tourismusbueros: `https://lasstreffen.at/region/X?utm_source=...` bzw. `/en/region/X?...`.

## Edge Cases & Constraints
- KEIN IP-/Accept-Language-Redirect (Google-Guideline; Detection ist aus).
- @modal Intercepted Route (.)events muss unter [locale] weiter funktionieren.
- not-found: Root-not-found braucht Root-Layout-Minimum; [locale]/not-found lokalisiert.
- API-Routen, Cron, OG-Images bleiben locale-frei.
- Middleware-Matcher darf api/_next/statics nicht anfassen (bestehende Matcher-Logik erhalten).
- Vitest-Suite (~547 Tests) + `npm run build` muessen gruen bleiben.
- Widget /widget/[region] bleibt vorerst DE (Embed, kein i18n-Scope).

## Acceptance Criteria
- [ ] `/map` rendert deutsch wie bisher (URL unveraendert, kein Redirect, kein Set-Cookie anonym)
- [ ] `/en` + `/en/map` rendern mit EN-Chrome, html lang="en"
- [ ] Sprachumschalter im TopNav wechselt auf die gleiche Seite in der anderen Sprache
- [ ] hreflang de/en/x-default auf Landing, /map, /entdecken, Event-Detail
- [ ] Sitemap enthaelt EN-Alternates
- [ ] Build strict + Tests gruen
- [ ] (Slice Lazy-Translation) EN-Event-Detail zeigt uebersetzte Beschreibung, gecacht in DB

## Boundaries
- Out of scope: Uebersetzung ALLER UI-Strings in einem Rutsch (iterativ pro Seite),
  Sprachen 3+, uebersetzte Slugs, Blog-Uebersetzung, Admin/Social-Bereiche (bleiben DE-first).

## Decision Context
Variante B (Pfad-Praefix) statt Cookie-Toggle: QR-Codes brauchen Sprache in URL; SEO braucht
eigene URLs. 'as-needed' statt 'always' damit bestehende DE-Rankings/Links nicht via Redirect
migriert werden muessen. Kein Cookie wegen SEO-Bypass in middleware.ts.
