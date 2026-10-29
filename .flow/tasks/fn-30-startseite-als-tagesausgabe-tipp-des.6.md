# fn-30-startseite-als-tagesausgabe-tipp-des.6 Unterbau: Programmliste, Wochenende, Region, Festivals/Blog, Freizeit, Newsletter-Zeile; alte Sektionen und i18n entfernen; /entdecken von/bis

## Description
## Ziel
Untere Hälfte der Tagesausgabe, Entfernen der alten Sektionen und `von`/`bis` auf
`/entdecken`. Größe M. Vorlage Mockup D (`.prog`, `.duo`, `.rowline`, Regale).

## Kontext
- Datenquelle (Task 3, `src/lib/v4/get-landing-data.ts`): `data.program` (`Event[]`, schon
  auf heutigen Wiener Tag, ab 17:00, bekannte Startzeit und Uhrzeit sortiert), `data.today`
  (für `von`/`bis` der Programmliste), `data.weekend` + `data.weekendRange` (`{ from, to }`,
  läuft das Wochenende, ist `from` = heute), `data.festivals` (`LandingFestival`: `acts:
  string[]`, `image_url` immer gesetzt inkl. Kategorie-Fallback, `href` = V2-URL des
  Elternevents sonst `/festivals/<slug>`; für den Link `/festivals/<slug>` aus `slug` bauen),
  `data.posts` (`LandingPost`: `slug, title, subtitle, image, publishDate, category,
  readingTime`; `pickPosts` schiebt Posts zu gelisteten Festivals nur nach hinten),
  `data.activities` (`LandingActivity`: `id, slug, name, tags, town, bundesland, setting,
  price_hint, images`, schon auf darstellbare Bilder gefiltert, 8 Stück).
  <!-- Updated by plan-sync: fn-30.3 Feldnamen von LandingData -->
- Programmliste `ProgramList` (RSC-Markup, Client-Insel blendet nach Laden Zeilen aus, deren
  Start > 60 min zurückliegt, und den Abschnitt bei leer): zwei Spalten Desktop, Uhrzeit mit
  `tabular-nums`, 46-px-Bild (`EventImage`), Titel, Ort, Preis (`priceBadge`). Link „Ganzes
  Programm“ → `/entdecken?von=<heute>&bis=<heute>`.
- Wochenende und Region über `Shelf`/`ShelfCard`/`RegionTile` aus
  `src/components/Discover/v4/shelf-ui.tsx` (Client-Komponenten, rendern im Server-HTML);
  `RegionTile` → `/{bundesland}` mit `BUNDESLAENDER` (`src/lib/bundeslaender.ts:16`) und
  `/images/regions/<id>.jpg`. „Alle anzeigen“ → `/entdecken?von=<fr>&bis=<so>`.
  Stand nach Task 8: `Shelf`-Props unverändert; die Spur ist jetzt die exportierte
  `ShelfTrack({ trackRef, label, children })` (endet an der Inhaltskante, `role="region"` mit
  Regaltitel, `data-more` + Handy-Verlauf über `.v4-shelf-track` in `globals.css`). Eine eigene
  Querscroll-Spur (falls `ActivitiesShelf` nicht `Shelf` nimmt) über `ShelfTrack`, ohne
  negative Ränder oder `scroll-padding-left`.
  <!-- Updated by plan-sync: fn-30.8 Spur als ShelfTrack ausgelagert, kein Überhang -->
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
  Stand nach Task 3: `ArtistTeaserV4`, `WeekendSection`, `ConcertsSection` rendert `page.tsx`
  nicht mehr (nur Dateien, Exporte, Tests übrig); `ArtistTeaserV4.tsx` definiert den Typ
  `LandingArtist` jetzt selbst (in `get-landing-data.ts` entfernt) und geht mit der Datei.
  `FestivalsSection` läuft noch mit `data.festivals`.
  <!-- Updated by plan-sync: fn-30.3 entfernte page.tsx-Sektionen und LandingArtist-Typ -->


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
