# Künstler-Tab: Befund und drei Mockup-Varianten (2026-11-02)

Der Künstler-Tab (`/artists`, Tab „Künstler“ in `V4TabBar` und `V4TopNav`) soll auf den Stand
der Tagesausgabe und von `/entdecken` kommen. Die Grundfunktion bleibt: einem Künstler folgen
und erfahren, wenn er in Österreich spielt. Neu ist, dass der Tab auch ohne Konto etwas zeigt.

## Entscheidung (2.11.2026, User)

Umgesetzt wird **B Plakatwand** (`b-plakatwand.html`) samt Künstlerblatt als Sheet.
Umsetzung: `src/app/[locale]/artists/page.tsx` (ISR), `src/lib/artists/directory.ts`
(Verzeichnis, Häuser-Regel, Regale, pur), `src/lib/artists/get-artists-directory.ts`
(Anon-Client, seitenweise), `src/components/Artists/v4/` (ArtistsWall, ArtistSheet,
artist-ui). Regal „Große Hallen“ aus dem Mockup wurde „Auf Tour“ (mindestens drei
Termine an zwei Orten), weil es keine Saalgrößen gibt; „Wer X mag, geht auch zu“ wurde
„Auch bald live“ (gleiche Spielart aus dem Verzeichnis statt Last.fm). A und C bleiben als
verworfene Varianten liegen. Das Blatt gibt es seit demselben Tag auch als Seite
`/kuenstler/[slug]` (Entscheidung des Users nach dem Merge von PR #424).

`index.html` öffnen (lokal über einen statischen Server, z. B.
`python -m http.server 5179 --directory docs/design/kuenstler-redesign`) und oben zwischen
Varianten, Gast/Eingeloggt und Desktop/Handy wechseln. Inhalte sind echt: 85 Künstler mit
Terminen bis Ende Jänner aus `event_artists` (Eventim-Feed, gelesen am 2.11.2026 über die
öffentliche REST-API), Ort aus der PLZ. Spotify-Bilder gibt es für Bilderbuch und Wanda im
Mockup nicht (die beiden stehen als Beispiel für „folgt, aber kein Termin“).

## 1. Was der Tab heute hat und kann

Gelesen in `src/app/[locale]/artists/`, `src/components/Artists/`, `src/app/api/artists/`,
`src/lib/artists/`, Migration `20260611_get_artist_appearances.sql`.

**Sichtbar auf der Seite**

- Login-Pflicht: `requireUserOrRedirect('/artists')` schickt jeden Gast zu `/auth/login`. Die
  Startseiten-Kachel „Diese Woche live“ verlinkt mit „Alle Künstler ›“ hierher, ein Gast landet
  im Login. 70 % der Besucher kommen über Google (MASTERPLAN §2), 42 Konten gibt es.
- Hero: Zweizeiler „Such einen Künstler. Wir sagen Bescheid, wenn er in Österreich spielt.“
  plus Eyebrow „Lieblingskünstler · Such & Folge“ (Versalien, Mitteldot).
- Spotify-Suche (ab 2 Zeichen, Enter), Ergebnis als Kartenliste mit Folgen-Knopf. Die Suche
  findet jeden Spotify-Künstler, auch einen, der nie in Österreich spielt; nach dem Folgen
  passiert sichtbar nichts (das Matching läuft nach der Antwort in `after()`, Treffer kommen
  erst beim nächsten Laden).
- Zwei Spalten: „Gefundene Auftritte in Österreich“ (Akkordeon je Künstler, Zeilen aus
  `get_artist_appearances`: Festival-Lineups plus Titel-Treffer) und „Deine Lieblingskünstler“
  (Raster, ab 8 eingeklappt, Zeile „Kein Termin · wir bleiben dran“).
- Kein Entfolgen auf der Seite (`DELETE /api/artists/follow` existiert, die Startseiten-Kachel
  nutzt ihn, `/artists` nicht). Kein Blick auf einen Künstler vor dem Folgen: man sieht nie,
  wann und wo er spielt, nur die Zahl „3 kommende Auftritte“.

**Gebaut, aber nicht sichtbar**

- `GET /api/artists/popular`: Last.fm-Österreich-Charts, über Spotify angereichert, 24 h gecacht.
- `POST /api/artists/similar`: ähnliche Künstler zu bis zu fünf gefolgten (Last.fm).
- `POST /api/artists/by-url`: Spotify-Link oder Track-Link einfügen, Künstler kommt zurück.
- `GET /api/spotify/status`: ob das Spotify-Konto verbunden ist.
- Benachrichtigungs-Einstellungen (`artist_alerts_enabled`, Kanäle) unter `/settings/notifications`.
- Seit fn-30 (2026-10-29): `event_artists` mit 13.009 Zeilen aus dem Eventim-Feed, je Künstler
  ID, Name, Bild und Affiliate-Link. Die Startseite rotiert daraus drei Künstler. `/artists`
  liest die Tabelle nicht.

**Datenbefund (für die Umsetzung):** Der Feed führt auch Häuser und Reihen als „Künstler“
(Burgtheater mit 30 Terminen, Graz Tourismus 19, Dschungel Wien 12, Spanische Hofreitschule,
House of Banksy). Ein Künstlerverzeichnis braucht eine Regel dafür, etwa: Künstler, deren Name
gleich dem Veranstaltungsort ist, oder deren Termine alle am selben Ort liegen, gelten als Haus
und bleiben draußen oder landen in einem eigenen Bereich „Häuser und Reihen“.

## 2. Warum die Seite heute generiert wirkt

1. Die Oberfläche erklärt sich selbst. Der Hero ist eine Bedienungsanleitung in 44 px, darunter
   ein Eingabefeld, darunter zwei leere Kästen mit Erklärtext („Such einen Künstler oben, wir
   benachrichtigen dich“). Eine Seite, die Künstler zeigt, erklärt nicht, dass sie Künstler
   zeigt.
2. Leer bei Ankunft. Ein neues Konto sieht ein Suchfeld und zwei gestrichelte Platzhalter. Nichts
   zum Anschauen, nichts zum Anklicken. Dabei stehen 13.000 Künstler-Termin-Zeilen in der DB.
3. Kästen in Kästen: Karte (rounded-2xl) im Akkordeon-Kasten (rounded-2xl) im Zweispalter, jede
   mit eigenem Rahmen, dazu der amber-farbige 3-px-Balken links an jeder Trefferkarte.
4. Versalien-Eyebrow mit Mitteldot, Zähler in Versalien mit 0,16 em Tracking rechts neben
   jeder H2, Fraunces-Kursiv-Initial als Bildplatzhalter. Dasselbe Gerüst wie die alte Startseite
   (ANALYSE.md im landing-redesign).
5. Die Seite spricht Englisch mit sich selbst: Route `/artists`, Tab „Künstler“, Hero
   „Lieblingskünstler“, Treffer „Auftritte“, API „matches“. Vier Wörter für eine Sache.
6. Rückmeldung ohne Folge: nach „Folgen“ ein Toast „Wir benachrichtigen dich bei
   Österreich-Terminen“, aber kein Termin erscheint, kein Künstler rückt in die Liste.

## 3. Grundsatz der drei Varianten

Alle drei Varianten teilen fünf Entscheidungen:

- **Offen für alle.** Der Tab zeigt ohne Konto, wer in Österreich spielt. Folgen braucht ein
  Konto (Knopf führt zum Login). Das macht die Seite indexierbar; jedes Künstlerblatt kann
  eine URL werden (`/kuenstler/alex-kristan`), mit Ticketlinks über die Affiliate-ID.
- **Eine Quelle für „wer spielt“:** `event_artists` (Eventim, Bild und Link liegen vor) plus
  die kuratierten Festival-Lineups. Die Spotify-Suche bleibt für Künstler, die noch keinen
  Termin haben: „Fehlt wer? Wir suchen auch bei Spotify.“ Spotify-Link einfügen geht im selben
  Feld (`by-url` existiert).
- **Ein Knopf, eine Stelle, eine Größe:** Folgen 88 × 30 px rechts in jeder Zeile, amber wenn
  aktiv, Beschriftung „Folgen“ / „Folgst du“, Entfolgen durch erneutes Tippen (wie auf der
  Startseite). Kein zweiter Weg.
- **Das Künstlerblatt** ist die neue Einheit: Porträt, Name, Spielart, Folgen, alle Termine in
  Österreich mit Tickets, „Wer X mag, geht auch zu“ (aus `similar`), Quellenzeile. In A und B
  ein Sheet (rechts am Desktop, von unten am Handy), in C die rechte Spalte.
- **Eingeloggt kommt eine Reihe dazu, keine zweite Seite:** „Deine Künstler“ mit Porträt, Name
  und nächstem Termin (amber, wenn diese Woche), „noch kein Termin“ für die anderen, ein
  Plus-Platz zum Hinzufügen, Link zu den Benachrichtigungen. Sonst bleibt die Seite gleich; die
  gefolgten Künstler stehen in den Listen zuerst und in amber.

Keine Eyebrows in Versalien, keine Mitteldot-Reihen, keine Striche, kein Erklärtext, keine
Kästen in Kästen, keine Funkel-Icons. Leere Zustände sind Aufforderungen („Folgen tippen, und
du bekommst eine Mail, sobald ein Termin in Österreich dazukommt“).

## 4. Die Varianten

| Variante | Einheit | Idee | Stärke | Schwäche |
|---|---|---|---|---|
| A `a-spielplan.html` Spielplan | der Tag | Tourkalender wie ein Spielplan: Tage links, daneben wer spielt, diese und nächste Woche komplett, danach der nächste Termin je Künstler. Filter nach Spielart und Bundesland. | Beantwortet „wer spielt diese Woche“ ohne einen Klick, dieselbe Zeilenform wie „Heute Abend“ auf der Startseite. Gut für Gäste. | Ein Künstler mit acht Terminen erscheint achtmal; Folgen wirkt als Nebensache. |
| B `b-plakatwand.html` Plakatwand | das Gesicht | Regale wie auf `/entdecken`, aber mit Porträts: Diese Woche live, Große Hallen, Kabarett, Konzerte. Darunter alle Künstler mit Termin von A bis Z. | Die Seite ist in zwei Sekunden als „Künstler“ lesbar, Bilder tragen; gleiche Regal-Sprache wie Startseite und /entdecken. | Regale brauchen Kuratierung („Große Hallen“ ist von Hand gesetzt), bei schwachen Bildern (schwarze Balken) leidet die Wand. |
| C `c-kartei.html` Kartei | der Künstler | Links das Verzeichnis (Deine Künstler, Diese Woche, A bis Z), rechts das Künstlerblatt. Am Handy ist das Blatt eine eigene Seite. | Das Künstlerblatt ist immer sichtbar, Tickets sind einen Klick entfernt, Verzeichnis und Blatt sind direkt die SEO-Seiten. | Am Desktop die dichteste Variante, am Handy zwei Ebenen; ohne Bilder in der Liste wirkt sie wie ein Telefonbuch. |

Empfehlung: **B als Seite, C als Künstlerblatt mit eigener URL.** B zeigt Gästen sofort, worum es
geht, und nutzt die Regale, die es schon gibt (`shelf-ui.tsx`); das Blatt aus C wird die
Detailseite, auf die Regal-Kacheln, die Startseiten-Kachel und Google verlinken. Der Spielplan
aus A kann als Filter „Nach Datum“ oder als eigenes Regal „Heute“ in B leben.

## 5. Was sich an der Technik ändert

- `/artists` ohne `requireUserOrRedirect`; Daten für Gäste über den cookie-freien Anon-Client
  (wie `get-landing-data.ts`), Regale als ISR, „Deine Künstler“ und der Folgen-Zustand als
  Client-Insel über `/api/me/landing` bzw. `/api/artists/following`.
- Neue Leseroute oder RPC für das Verzeichnis: Künstler aus `event_artists` mit sichtbarem
  Termin in Österreich (Join `events`, `country = 'AT'`, `publish_status = 'published'`,
  Dedup auf den Primary wie in `followed-live.ts`), gruppiert je Künstler mit nächstem Termin
  und Zahl. Häuser und Reihen ausfiltern (siehe Datenbefund).
- Künstlerblatt: `/kuenstler/[slug]` (Slug aus Name und Feed-ID), Termine mit Affiliate-Link
  (`evo_link`, `data-track="ticket_click"`), Lineup-Auftritte aus `festival_artists` dazu,
  ähnliche Künstler aus `/api/artists/similar` (clientseitig, Last.fm bleibt unsichtbar).
- Suche: erst lokal im Verzeichnis (sofort), dann Spotify (`/api/artists/search`, braucht Konto,
  Gäste sehen den Hinweis), Spotify-Link über `by-url`.
- Folgen: `POST`/`DELETE /api/artists/follow` wie in `ArtistsLive.tsx`, optimistisch, nach dem
  Folgen rückt der Künstler sofort in „Deine Künstler“ (die Termine kennt die Seite schon aus
  dem Verzeichnis, das Matching in `after()` bleibt für Festival-Lineups).
