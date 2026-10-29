# fn-30-startseite-als-tagesausgabe-tipp-des.5 Bühne: Masthead mit DateLine, TipOfDay, MapTile, SeasonCard-Anpassung, page.tsx

## Description
## Ziel
Obere Hälfte der Tagesausgabe: Kopf mit Datumszeile, Bühne mit Tipp des Tages, Saison, Karte,
Künstler-Kachel; `page.tsx` setzt sie zusammen. Größe M. Vorlage Mockup D
(`docs/design/landing-redesign/d-tagesausgabe.html`, CSS-Blöcke `.mast`, `.stage`, `.tip`,
`.sea`, `.map`, `.art`), Tokens aus `globals.css` (`--v4-*`).

## Kontext
- `src/app/[locale]/page.tsx:64-69`: `hasLocale` → `setRequestLocale` → `getTranslations`
  (Reihenfolge Pflicht, sonst dynamisch). `revalidate = 3600` bleibt. Kein `cookies()`.
- Datumszeile (`Masthead` RSC + `DateLine` Client-Insel): Wiener Tag, Wetter heute in Wien
  (neue Funktion neben `loadWeekendWeather` in `src/lib/landing/weekend-weather.ts`, die den
  heutigen Tag liefert; Platz reservieren), Zahl aus `countryTotal` gerundet. `DateLine`
  rechnet nach dem Laden den Wiener Tag neu (Mitternacht) und meldet ihn an die Programmliste
  (Task 6) über ein kleines Context/Event.
- `TipOfDay`: Bild über `EventImage` mit `preload` (LCP), Label „Tipp des Tages“, bei
  `kind='sponsored'` „Anzeige“ + `sponsorName`, zweite Zeile `sponsorName` sonst
  `location_name`, Knopf „Tickets ab …“ (`priceBadge`, `src/lib/v4/price-badge.ts:21`) sonst
  „Zum Event“ → `buildEventUrlV2`; `data-track="landing_tip_click"`, `data-track-id`,
  `data-track-kind`.
- `SeasonCard` (`src/components/Landing/v4/SeasonCard.tsx`): 6 Picks, Liste füllt die Karte,
  Ellipsis, „Tipp“-Badge nur für `editorial`-Pins.
- `MapTile`: plain `<img>` mit `srcset` aus `map-static-url.ts` (Task 3), Logo an,
  Attributionszeile „© Mapbox © OpenStreetMap · Karte verbessern“ mit Links unter der Kachel,
  Fallback ohne Token/Bildfehler, `data-track="landing_map_open"`.
- `ArtistsLive` aus Task 4 einsetzen; ohne Pool Karte zwei Zeilen hoch.
- Raster: Desktop `1.45fr 1fr 1fr`, Zeilen 256 px; < 1000 px zwei Spalten; < 720 px eine
  Spalte (Tipp 320 px, Karte 180 px). Kein horizontales Scrollen.
- Entfernen in `page.tsx`: `HeroV4`-Import, Dev-Banner oben (Text wandert zum Footer in Task
  6), `Onboarding`. `AuthErrorToast` bleibt.
- i18n: `Landing.Masthead`, `Landing.Tip`, `Landing.Map` in de/en; `Landing.Season` bleibt.

**Files:** `src/app/[locale]/page.tsx`, `src/components/Landing/v4/Masthead.tsx`,
`DateLine.tsx`, `TipOfDay.tsx`, `MapTile.tsx` (neu), `SeasonCard.tsx`,
`src/lib/landing/weekend-weather.ts`, `messages/de.json`, `messages/en.json`,
`src/__tests__/components/landing-stage.test.tsx` (neu), `src/__tests__/components/date-line.test.tsx` (neu).
## Acceptance
- [ ] `/` rendert Kopf und Bühne aus `getLandingData()`; `next build` zeigt `/` und `/en` als
      statisch (ISR), kein `cookies()`/`headers()` im RSC-Pfad.
- [ ] Datumszeile zeigt Wiener Tag, Wetter heute in Wien (nach Laden, ohne Layoutsprung) und
      die gerundete Zahl aus `countryTotal`; `DateLine` korrigiert den Tag nach Mitternacht
      (Test mit gestellter Uhr).
- [ ] Tipp zeigt bei `sponsored` „Anzeige“ und den Sponsornamen, sonst kein Label; Knopf
      führt zur Detailseite; Bild ist das LCP-Element mit `preload`.
- [ ] Saison-Karte zeigt sechs Picks, kein Text ragt über die Karte.
- [ ] Karten-Kachel: Bild aus `map-static-url`, Logo sichtbar, Attributionszeile mit Links,
      Fallback ohne Token.
- [ ] Mobile 390 px: eine Spalte, kein horizontales Scrollen; Desktop 1440 px: Raster wie im
      Mockup (Screenshots im PR).
- [ ] DE/EN-Texte vorhanden; `npm test` grün.
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
