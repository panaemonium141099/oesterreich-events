# fn-30-startseite-als-tagesausgabe-tipp-des.4 Diese Woche live: /api/me/landing followedLive + ArtistsLive-Kachel mit Folgen

## Description
## Ziel
Kachel „Diese Woche live“ als Client-Insel mit Folgen/Entfolgen, dazu `followedLive` und
`followedNames` in `/api/me/landing`. Größe M.

## Kontext
- `src/app/api/me/landing/route.ts`: Auth über `getLandingContext()`
  (`src/lib/v4/get-landing-context.ts:25`), anonym `{signedIn:false, …}` mit `no-store`,
  eingeloggt `private, max-age=60`. Ergänzen: `followedLive` (gefolgte Künstler mit Termin in
  7 Wiener Tagen aus `event_artists` + `events!inner` mit `country`, `publish_status`; Felder
  artist_id, artist_name, artist_image, evo_link, Event mit `EVENT_URL_COLUMNS`) und
  `followedNames` (alle gefolgten Namen, normalisiert).
- Abgleich in JS mit `normalizeArtistName` aus `src/lib/artist-matching.ts:98` auf beiden
  Seiten (`followed_artists.artist_name_normalized` ist nur `lower()`; drei Normalisierer im
  Repo, dieser ist der des Follow-Pfads).
- Follow-API: POST `/api/artists/follow` `{artist_name, spotify_image_url?, source:'manual'}` →
  201 (`src/app/api/artists/follow/route.ts:130`), DELETE `{artist_name}` (189). Optimistisches
  Muster: `src/components/Artists/v4/V4ArtistSearchResult.tsx:66-94`.
- Cookie-Heuristik wiederverwenden: `hasSupabaseAuthCookie` aus `src/lib/ads/ads-allowed.ts:34`;
  anonyme Besucher feuern keinen Request.
- Login-Link: `/auth/login?redirect=/` (die Login-Seite liest `redirect`,
  `src/app/[locale]/auth/login/page.tsx:26`).
- Barrierefreiheit: wechselnde Beschriftung „Folgen“/„Folgst du“ ohne `aria-pressed`,
  `aria-label="<Name> folgen|entfolgen"`, Ziel ≥ 24 px, `min-width: 88px`, `white-space:
  nowrap`, feste Grid-Spalte. Anonym ist der Knopf ein Link.
- Hinweistext: prüfen, ob `sendArtistAlertEmail` (`src/lib/artist-matching.ts`) bei neuen
  Treffern wirklich Mails schickt; sonst neutrale Formulierung ohne Mail-Versprechen.
- Austausch nach Laden ohne Höhensprung: gleiche Zeilenzahl (3), gleiche Zeilenhöhe.
- i18n: neuer Namespace `Landing.ArtistsLive` in de.json und en.json; nicht in
  `SERVER_ONLY_NAMESPACES` (`src/app/[locale]/layout.tsx:298`).

**Files:** `src/app/api/me/landing/route.ts`, `src/components/Landing/v4/ArtistsLive.tsx`
(neu), `messages/de.json`, `messages/en.json`, `src/__tests__/api/me-landing.test.ts` (neu
oder bestehend erweitern), `src/__tests__/components/artists-live.test.tsx` (neu).
## Acceptance
- [ ] `/api/me/landing` liefert eingeloggt `followedLive` und `followedNames`; anonym bleibt die
      Antwort unverändert und `no-store`; `landing-url-columns`- und site-country-Wächter grün.
- [ ] `ArtistsLive` rendert die Rotation aus dem statischen HTML, holt nur mit sb-Cookie die
      API und zeigt gefolgte Künstler zuerst, rotierte gefolgte als „Folgst du“.
- [ ] Folgen setzt den Zustand sofort und rollt bei Nicht-2xx zurück (Test mit gemocktem
      fetch, 401 und 500); „Folgst du“ ruft DELETE.
- [ ] Anonym ist der Knopf ein Link auf `/auth/login?redirect=/`.
- [ ] Knöpfe sind ≥ 88 px breit, gleiche Spalte in jeder Zeile, mit `aria-label`, ohne
      `aria-pressed`; `data-track="landing_artist_follow"` mit `data-track-id` = Künstlername.
- [ ] DE- und EN-Texte vorhanden; `npm test` grün.
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
