# Funnel Phase 1: Follow-System + After-Save Flow

## Goal & Context

Persistente Werte fur Stadt und Venue ermoglichen. Event Detail von einer Sackgasse zu einem Weiterfuhrungs-Hub machen. Aktuell kann ein Nutzer nur Events speichern und Artists folgen — es fehlt die Moglichkeit, Stadten und Venues zu folgen, und nach dem Speichern gibt es keinen weiteren CTA.

**Referenz:** Bericht 2 — Abschnitt 10, Phase 1 (Basis-Funnel stabilisieren)

**Approach:** Follow-Mechanik fur City/Venue + After-Save CTAs + Related Events auf Event Detail. Kein neues Routing, keine Landingpages (Phase 2), keine Trigger/Digests (Phase 5).

---

## 1. Datenmodell (Supabase)

### 1.1 `followed_cities`

Stadt-Follow basiert auf einem kanonischen Schlussel aus `city_normalized` + `bundesland`. Das verhindert Dubletten durch unterschiedliche Schreibweisen.

```sql
CREATE TABLE followed_cities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  city            text NOT NULL,            -- Anzeigename, z.B. "Wien", "Graz"
  city_normalized text NOT NULL,            -- Lowercase, trimmed, z.B. "wien", "graz"
  bundesland      text NOT NULL,            -- Pflichtfeld fur Eindeutigkeit
  created_at      timestamptz DEFAULT now(),
  UNIQUE(user_id, city_normalized, bundesland)
);

CREATE INDEX idx_followed_cities_user ON followed_cities(user_id);

ALTER TABLE followed_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own followed cities"
  ON followed_cities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own followed cities"
  ON followed_cities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own followed cities"
  ON followed_cities FOR DELETE
  USING (auth.uid() = user_id);
```

### 1.2 `followed_venues`

```sql
CREATE TABLE followed_venues (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  venue_id    uuid REFERENCES venues(id) ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, venue_id)
);

CREATE INDEX idx_followed_venues_user ON followed_venues(user_id);

ALTER TABLE followed_venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own followed venues"
  ON followed_venues FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own followed venues"
  ON followed_venues FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own followed venues"
  ON followed_venues FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 2. City-Ableitung fur Events

Events haben kein eigenes `city`-Feld. Die Stadt wird so abgeleitet:

1. **Event hat `venue_id`** → Stadt aus `venues.city` (JOIN)
2. **Event hat kein `venue_id`** → Stadt aus `address`-Feld extrahieren (letzter Bestandteil nach Komma, analog zur Logik in `location-normalizer.ts`)
3. **Kein Fallback auf Bundesland** — wenn weder Venue-City noch Address-Parsing eine echte Stadt liefern, gibt `extractCity()` `null` zuruck. Der Follow-City-Button wird in dem Fall nicht angezeigt.

**Ausnahme Stadtstaat Wien:** Wenn `bundesland === 'Wien'` und keine Stadt aus Schritt 1/2 ableitbar ist, wird `"Wien"` als Stadt gesetzt. Wien ist gleichzeitig Stadt und Bundesland, daher ist das korrekt. Fur alle anderen Bundeslander (Tirol, Steiermark, etc.) gibt es keinen Fallback — einem Bundesland zu folgen ist konzeptionell etwas anderes als einer Stadt zu folgen.

Die Ableitung passiert serverseitig in `page.tsx` beim Laden des Events. Es wird NICHT `location_name` verwendet — das ist typischerweise ein Venue-/Ortsname ("Flex", "Dorfplatz"), keine Stadt.

**Hilfsfunktion:** `src/lib/utils/city.ts`

```ts
/** Bundeslaender die gleichzeitig Staedte sind */
const CITY_STATES = new Set(['Wien']);

/**
 * Extracts the city name from an event's data.
 * Priority: venue.city > address parsing > city-state fallback (Wien only)
 * Returns null if no real city can be derived — no Follow-Button in that case.
 */
export function extractCity(event: {
  address?: string | null;
  bundesland?: string | null;
}, venueCity?: string | null): string | null
```

---

## 3. API Routes

Follow-CRUD (Create/Delete/Read-Status) lauft direkt uber den Supabase Browser-Client + RLS. Es gibt keine POST/DELETE API-Routes fur Follows. Die Listing-Endpoints existieren nur fur serverseitige Konsumenten (Profil-Seite, Digest-System in Phase 5).

### 3.1 `GET /api/cities/following`

**Datei:** `src/app/api/cities/following/route.ts`

- Listing-Endpoint fur serverseitige Konsumenten (Profil, Digests)
- Auth required
- Response: `{ cities: [{ city, bundesland, created_at }] }`

### 3.2 `GET /api/venues/following`

**Datei:** `src/app/api/venues/following/route.ts`

- Listing-Endpoint fur serverseitige Konsumenten (Profil, Digests)
- Auth required
- Join auf `venues` Tabelle fur Name/Stadt
- Response: `{ venues: [{ venue_id, name, city, created_at }] }`

### 3.3 `GET /api/events/related`

**Datei:** `src/app/api/events/related/route.ts`

- Parameter: `eventId` (required), `limit` (default 4, max 8)
- **Ranking-Logik** (nicht nur Filter):
  1. Event laden (Stadt/Venue/Kategorie/Datum holen; Stadt via `extractCity()`)
  2. Kandidaten: `start_date >= today`, `publish_status = 'published'`, `quality_score >= 50`, exkludiert aktuelles Event
  3. **Scoring der Kandidaten:**
     - Gleiche Stadt (via Venue-City oder Address-Parsing): +3 Punkte
     - Gleiche Kategorie: +2 Punkte
     - Gleiche Venue: +4 Punkte
     - Zeitnahe (innerhalb 7 Tage): +1 Punkt
  4. Sortiert nach Ranking-Score DESC, dann `event_score DESC`
  5. Limit anwenden
- Quality-Gate: `quality_score >= 50` (konservativ — Empfehlungen sollen stark wirken)
- Response: `{ events: Event[] }`

---

## 4. Komponenten

### 4.1 `FollowCityButton`

**Datei:** `src/components/Follow/FollowCityButton.tsx`

```
Props: { city: string, bundesland: string }
```

- Client Component (`'use client'`)
- **Read + Write direkt uber Supabase Client** (konsistent, RLS schutzt beides)
- Pruft on-mount via `supabase.from('followed_cities').select('id').eq(...)` ob User der Stadt folgt
- Toggle bei Klick (insert/delete direkt uber Supabase Client, kein API-Umweg)
- States: idle, loading, followed
- Ohne Auth: Toast "Bitte melde dich an"
- Styling: Pill-Button mit Herz/Plus-Icon

### 4.2 `FollowVenueButton`

**Datei:** `src/components/Follow/FollowVenueButton.tsx`

```
Props: { venueId: string, venueName: string }
```

- Gleiche Architektur: Read + Write direkt uber Supabase Client + RLS
- Pruft `followed_venues` statt `followed_cities`

### 4.3 `RelatedEvents`

**Datei:** `src/components/Events/RelatedEvents.tsx`

- Client Component
- Fetcht `/api/events/related?eventId=...&limit=4`
- Rendert `EventPreviewCard` in einem 2x2 Grid (mobile: 1 Spalte)
- Loading: 4 Skeleton-Cards
- Leer: gesamte Sektion hidden (kein leerer Block)
- Uberschrift: "Ahnliche Events"

### 4.4 `AfterSavePanel`

**Datei:** `src/components/Events/AfterSavePanel.tsx`

- Client Component, animiert (Framer Motion slide-down)
- Wird in `EventDetailActions` gerendert
- **Anzeige-Logik:**
  - Erscheint einmalig nach frischem Save (nicht bei Page-Reload wenn bereits gespeichert)
  - Verschwindet sofort bei Unsave
  - Dismissbar uber X-Button
  - Springt NICHT erneut auf wenn Event Detail nochmal geoffnet wird
- Inhalte:
  - **Reminder setzen** — Button, schreibt in `event_reminders` Tabelle (eigene Tabelle, NICHT `saved_events.remind_at`)
  - **Stadt folgen** — `FollowCityButton` (nur wenn Stadt abgeleitet werden konnte)
  - **Venue folgen** — `FollowVenueButton` (nur wenn `venue_id` vorhanden)
  - **An Freund senden** — Share-Button (Web Share API / Clipboard Fallback)

**Reminder-Modell:** Save und Reminder sind getrennte Konzepte.
- Save = Bookmark (`saved_events` Tabelle)
- Reminder = eigener Datensatz (`event_reminders` Tabelle, existiert bereits)
- After-Save-CTA lost Reminder-Erstellung aus, uberladt aber nicht die Save-Entitat

---

## 5. Anderungen an bestehenden Dateien

### 5.1 `src/app/events/[id]/page.tsx`

Anderungen:

1. **Event-Query erweitern:** Zweiter Query auf `venues` Tabelle wenn `venue_id` vorhanden, um `venue.name` und `venue.city` zu holen
2. **City ableiten:** Via `extractCity(event, venue?.city)` — NICHT `location_name`
3. **Props an EventDetailActions erweitern:**
   ```tsx
   <EventDetailActions
     eventId={event.id}
     eventTitle={event.title}
     city={derivedCity}                     // NEU — aus extractCity()
     bundesland={event.bundesland}          // NEU
     venueId={event.venue_id}              // NEU
     venueName={venue?.name}               // NEU (aus Venue-Query)
     startDate={event.start_date}          // NEU (fur Reminder Default-Datum)
   />
   ```
4. **Venue-Link:** Wenn `venue_id` vorhanden, Venue-Name als Link auf `/map?venueId={venue_id}` (funktionales Ziel, kein Dummy-`#`)
5. **Stadt-Link:** Wenn `derivedCity` vorhanden, Location clickable auf `/map?city={derivedCity}&bundesland={bundesland}`. Fallback ohne Stadt: `/map?bundesland={bundesland}`
6. **RelatedEvents am Ende:** `<RelatedEvents eventId={event.id} />` nach dem Content-Block

### 5.2 `src/components/Events/EventDetailActions.tsx`

Anderungen:

1. **Props erweitern:** `city`, `bundesland`, `venueId`, `venueName`, `startDate` hinzufugen
2. **After-Save State:** `showAfterSave: boolean` — wird `true` nur bei frischem Save-Klick (nicht bei bereits gespeichertem Event), wird `false` bei Unsave oder Dismiss
3. **AfterSavePanel rendern:** Conditional unterhalb der Action-Buttons

---

## 6. Architektur-Entscheidungen

### Read/Write-Pfad: Konsistent uber Supabase Client + RLS

Alle Follow-Operationen (Read-Status, Insert, Delete) laufen direkt uber den Supabase Browser-Client. RLS Policies schutzen den Zugriff. Das ist konsistent mit der bestehenden Bookmark-Logik in `EventDetailActions`.

Die GET-Listing-Endpoints (`/api/cities/following`, `/api/venues/following`) existieren fur serverseitige Konsumenten (Profil-Seite, Digest-System in Phase 5). Die Follow-Buttons selbst nutzen sie nicht.

### Reminder bleibt eigene Tabelle

Die bestehende `event_reminders` Tabelle wird genutzt. `saved_events.remind_at` wird ignoriert — Save und Reminder sind getrennte Konzepte. Der After-Save-CTA erstellt einen neuen Eintrag in `event_reminders`.

---

## 7. Dateiubersicht

| Aktion | Datei |
|---|---|
| Migration | Supabase: `followed_cities` + `followed_venues` + RLS + Indexes |
| Neue Util | `src/lib/utils/city.ts` — `extractCity()` |
| Neue API | `src/app/api/cities/following/route.ts` (Listing) |
| Neue API | `src/app/api/venues/following/route.ts` (Listing) |
| Neue API | `src/app/api/events/related/route.ts` |
| Neue Komponente | `src/components/Follow/FollowCityButton.tsx` |
| Neue Komponente | `src/components/Follow/FollowVenueButton.tsx` |
| Neue Komponente | `src/components/Events/RelatedEvents.tsx` |
| Neue Komponente | `src/components/Events/AfterSavePanel.tsx` |
| Editieren | `src/app/events/[id]/page.tsx` |
| Editieren | `src/components/Events/EventDetailActions.tsx` |

---

## 8. Abgrenzung

**Nicht in Phase 1:**
- Keine Venue-Detailseiten (`/venues/[slug]`) — Phase 4
- Keine Stadt-Landingpages (`/[city]`, `/[city]/heute`) — Phase 2
- Keine Studenten-Seiten — Phase 3
- Keine Trigger/Digests/Alerts — Phase 5
- Keine Profil-Erweiterung (preferred_city etc.) — Phase 5
- Venue-Links zeigen auf `/map?venueId=...`, nicht auf eigene Venue-Seite
- `saved_events.remind_at` wird nicht angefasst — Reminder laufen uber `event_reminders`

---

## 9. Akzeptanzkriterien

- [ ] User kann einer Stadt folgen/entfolgen (kanonischer Key: city_normalized + bundesland)
- [ ] User kann einer Venue folgen/entfolgen
- [ ] Follow-Status wird on-mount korrekt geladen (direkt uber Supabase Client + RLS)
- [ ] City wird korrekt abgeleitet: Venue-City > Address-Parsing > Wien-Sonderfall (kein generischer Bundesland-Fallback)
- [ ] Nach frischem Event-Save erscheint After-Save Panel einmalig
- [ ] After-Save Panel verschwindet bei Unsave und springt nicht bei Reload erneut auf
- [ ] After-Save Panel zeigt Reminder (schreibt in `event_reminders`), Stadt-Follow, Venue-Follow, Teilen
- [ ] Event Detail zeigt Related Events am Ende (4 Events, Ranking-basiert, quality_score >= 50)
- [ ] Related Events werden nach Relevanz gerankt (Venue > Stadt > Kategorie > Zeitnahe)
- [ ] Event Detail zeigt Venue-Name als Link auf `/map?venueId=...` (wenn vorhanden)
- [ ] Nicht-eingeloggte User bekommen Toast bei Follow-Versuch
- [ ] RLS Policies verhindern Zugriff auf fremde Follows
- [ ] `npm run build` kompiliert fehlerfrei
- [ ] Bestehende Tests brechen nicht
