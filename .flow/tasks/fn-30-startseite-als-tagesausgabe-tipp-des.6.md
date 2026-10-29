# fn-30-startseite-als-tagesausgabe-tipp-des.6 Unterbau: Programmliste, Wochenende, Region, Festivals/Blog, Freizeit, Newsletter-Zeile; alte Sektionen und i18n entfernen; /entdecken von/bis

## Description
## Ziel
Untere Hälfte der Tagesausgabe, Entfernen der alten Sektionen und `von`/`bis` auf
`/entdecken`. Größe M. Vorlage Mockup D (`.prog`, `.duo`, `.rowline`, Regale).

## Kontext
- Programmliste `ProgramList` (RSC-Markup, Client-Insel blendet nach Laden Zeilen aus, deren
  Start > 60 min zurückliegt, und den Abschnitt bei leer): zwei Spalten Desktop, Uhrzeit mit
  `tabular-nums`, 46-px-Bild (`EventImage`), Titel, Ort, Preis (`priceBadge`). Link „Ganzes
  Programm“ → `/entdecken?von=<heute>&bis=<heute>`.
- Wochenende und Region über `Shelf`/`ShelfCard`/`RegionTile` aus
  `src/components/Discover/v4/shelf-ui.tsx` (Client-Komponenten, rendern im Server-HTML);
  `RegionTile` → `/{bundesland}` mit `BUNDESLAENDER` (`src/lib/bundeslaender.ts:16`) und
  `/images/regions/<id>.jpg`. „Alle anzeigen“ → `/entdecken?von=<fr>&bis=<so>`.
- `/entdecken`: `deriveInitialFilters` (`src/app/[locale]/entdecken/page.tsx:40-68`) lernt
  `von`/`bis` (ISO-Datum → `dateFrom`/`dateTo` in `EventFilters`, Muster `saison`); der
  `listModeKey` nimmt beide auf. Sonst keine Änderung an `/entdecken`.
- `FestivalsBlog`: zwei Listen nebeneinander (92×64-Bild, Titel, Zeitraum · Ort, Acts bzw.
  Kategorie · Datum), Links `/festivals/<slug>` und `/blog/<slug>`; < 720 px untereinander.
- `ActivitiesShelf`: `Shelf` mit `ActivityCardImage` (Bildnachweis), Kategorie-Badge aus
  `activityTagLabel`, Titel per Client nach Wetter („Bei Regen“ ab 3 mm, sonst „Ausflug unter
  Dach“), Link `/aktivitaeten?setting=indoor`.
- `NewsletterRow`: Logik aus `NewsletterSignup.tsx:26-56` übernehmen (POST, REGIONS,
  `data-track="newsletter_subscribe"`), eine Zeile mit E-Mail, Region, Knopf, Datenschutzzeile
  darunter; „freitags“ nur, wenn der Versandplan es bestätigt (`vercel.json`/`lt-cron`),
  sonst „einmal pro Woche“.
- Footer: `src/components/Legal/Footer.tsx` bekommt eine optionale Hinweiszeile (Prop), Text
  ohne Gedankenstrich.
- Entfernen: `HeroV4`, `ArtistTeaserV4`, `AnonFollowTeaser`, `PersonalizedMatches`,
  `MatchesSection`, `HowItWorks`, `MapPreview`, `RegionHubsSection`, `ConcertsSection`,
  `FestivalsSection`, `WeekendSection`, `WeatherSection`, `NewsletterSignup`, `Onboarding`
  (+ Namespace), `V4CardHero`, `V4CardV`, `V4CardH` samt Tests und Exporten in
  `src/components/Landing/v4/index.ts` und `src/components/Events/v4/index.ts`; tote
  i18n-Schlüssel in de/en (`Landing.Hero.trendLabel`, `ArtistTeaser`, `Weekend`, `Concerts`,
  `Festivals`, `MapPreview`, `HowItWorks`, `RegionHubs`, `Matches`, `AnonTeaser`, `Weather`,
  `Onboarding`). Vorher `grep` auf jede Komponente (z. B. `V4FestivalCard` bleibt,
  `festivals/page.tsx`). `cta_artist_search` darf nicht mehr vorkommen.

**Files:** `src/app/[locale]/page.tsx`, `src/components/Landing/v4/ProgramList.tsx`,
`FestivalsBlog.tsx`, `ActivitiesShelf.tsx`, `NewsletterRow.tsx` (neu), `index.ts`,
`src/components/Legal/Footer.tsx`, `src/app/[locale]/entdecken/page.tsx`,
`src/components/Events/v4/index.ts`, gelöschte Komponenten und Tests, `messages/de.json`,
`messages/en.json`, `src/__tests__/components/program-list.test.tsx` (neu).
## Acceptance
- [ ] Reihenfolge unter der Bühne: Heute Abend, Dieses Wochenende, Nach Region, Festivals +
      Blog, Freizeit, Newsletter-Zeile, Footer mit Hinweis.
- [ ] Programmliste blendet nach dem Laden abgelaufene Zeilen aus und entfällt bei leer (Test).
- [ ] `/entdecken?von=…&bis=…` setzt `dateFrom`/`dateTo` (Test in den bestehenden
      entdecken-Tests); „Ganzes Programm“ und „Alle anzeigen“ zeigen die passenden Tage.
- [ ] Festival-Liste und Blog-Liste zeigen je vier Einträge mit Bild; dasselbe Festival steht
      nicht in beiden Spalten nebeneinander.
- [ ] Freizeit-Regal zeigt Fotos mit Bildnachweis; Titel wechselt bei Regen.
- [ ] Newsletter-Zeile sendet wie bisher und zeigt den Datenschutzhinweis.
- [ ] Alle genannten Komponenten, Tests, Exporte und i18n-Schlüssel sind entfernt; `grep -r
      cta_artist_search src` leer; de.json und en.json haben dieselben Landing-Schlüssel.
- [ ] `npm test` grün; Mobile 390 px ohne horizontales Scrollen (Screenshot im PR).
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
