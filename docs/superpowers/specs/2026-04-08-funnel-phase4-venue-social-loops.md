# Funnel Phase 4: Venue-Detailseiten + Social Flow

## Goal & Context

Venue-Seiten und Social Sharing Loop aufbauen. Ein Event ist einmalig, eine Venue ist dauerhaft. Wer einer Venue folgt, erzeugt wiederkehrenden Wert: neue Events, neue Reihen, Stammverhalten. Der Social Flow macht aus einzelnem Event-Save eine geteilte Planung.

**Referenz:** Bericht 2 — Abschnitt 10, Phase 4 (Venue- und Social-Loops) + Abschnitt 4 (Funnel 4 + 5)

**Approach:** Venue-Detailseiten als SEO-indexierbare Einstiegspunkte + ShareSheet-Integration in den After-Save Flow. Kein neues Social-Infrastruktur-Building — die Social-Features (DM, Groups, Feed, ShareSheet) existieren bereits vollstandig. Phase 4 verbindet sie nur besser mit dem Event-Flow.

---

## 1. Datenlage

| Datenpunkt | Wert |
|---|---|
| Venues gesamt | 5.637 (2.941 Bars, 2.240 Pubs, 384 Nightclubs, 72 Student Orgs) |
| Venues mit Events (venue_id verknupft) | 119 |
| Top-Venue: pm Innsbruck | 105 Events |
| Top-Venue Wien: Chelsea | 49 Events |
| Venues mit Website | 1.585 |
| Venues mit City | 2.485 |

**Venue-Verfugbarkeitsregel:** Eine Venue-Seite existiert nur, wenn die Venue mindestens 1 **zukunftiges, veroffentlichtes Event mit quality_score >= 40** hat. Diese Regel gilt einheitlich fur:
- Routing (404 wenn nicht erfullt)
- Sitemap (nur qualifizierte Venues)
- Similar Venues (nur auf qualifizierte Venues verlinken)
- Event Detail Venue-Links (nur verlinken wenn Venue qualifiziert)

Die restlichen ~5.500 Venues ohne qualifizierende Events bekommen keine eigene Seite.

---

## 2. Venue-Detailseiten

### 2.1 Routing

```
/venues/[id]                    → Venue-Detailseite (UUID-basiert)
```

UUID statt Slug weil: Venue-Namen sind nicht einzigartig (es gibt mehrere "Bar" oder "Cafe" Eintraege), und ein Slug-System wurde zusatzliche DB-Spalte + Migrations-Logik brauchen. Die UUID ist bereits der primare Schlussel und wird in Phase 1 bereits als Link-Ziel verwendet (`/map?venueId=...`).

### 2.2 Seitenaufbau

```
┌─────────────────────────────────────────┐
│ Breadcrumb: Home > Chelsea               │
├─────────────────────────────────────────┤
│ H1: "Chelsea"                           │
│ Typ-Badge: Nightclub                    │
│ Stadt: Wien                             │
│ [Follow-Button]                         │
├─────────────────────────────────────────┤
│ Info-Block:                             │
│   Adresse | Website | Social Links      │
├─────────────────────────────────────────┤
│ Kommende Events (chronologisch)         │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ │Event1│ │Event2│ │Event3│ │Event4│    │
│ └──────┘ └──────┘ └──────┘ └──────┘    │
├─────────────────────────────────────────┤
│ [Mehr Events laden]                     │
├─────────────────────────────────────────┤
│ Ahnliche Venues (gleicher Typ + Stadt)  │
│ ┌──────┐ ┌──────┐ ┌──────┐             │
│ │Venue1│ │Venue2│ │Venue3│             │
│ └──────┘ └──────┘ └──────┘             │
├─────────────────────────────────────────┤
│ Interne Links                           │
│ "Mehr in Wien: /wien"                   │
│ "Nightlife in Wien: /wien/nightlife"    │
├─────────────────────────────────────────┤
│ JSON-LD LocalBusiness                   │
└─────────────────────────────────────────┘
```

### 2.3 Venue-Detail API

**Neue Datei:** `src/app/api/venues/[id]/route.ts`

- GET: Venue-Daten + Event-Count + naechste 20 Events
- Response: `{ venue, events, totalEvents, similarVenues }`
- Offentlich (kein Auth required) — Venue-Daten sind public

### 2.4 Similar Venues

Ahnliche Venues basierend auf:
1. Gleicher Typ + gleiche Stadt (z.B. andere Nightclubs in Wien)
2. Gleicher Typ + gleiches Bundesland (falls Stadt zu wenig liefert)
3. Max 6 Ergebnisse
4. Nur Venues die die Verfugbarkeitsregel erfullen (mindestens 1 zukunftiges, published Event mit quality_score >= 40)

### 2.5 JSON-LD

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Chelsea",
  "address": { "@type": "PostalAddress", "addressLocality": "Wien" },
  "url": "https://chelsea.co.at",
  "event": [...]
}
```

### 2.6 Venue-Link Update

Phase 1 setzt Venue-Links auf `/map?venueId=...`. Diese werden jetzt auf `/venues/[id]` umgebogen:
- `src/app/events/[id]/page.tsx` — Venue-Name Link
- Uberall wo `venueId` als Link verwendet wird

---

## 3. Social Flow: ShareSheet in After-Save

### 3.1 Problem

Aktuell ist der "Teilen" Button im AfterSavePanel ein einfacher Clipboard-Copy. Die Plattform hat bereits eine vollwertige ShareSheet-Komponente (`src/components/Share/ShareSheet.tsx`) mit WhatsApp, Facebook, Email, In-App-DM und Friend-Picker. Diese wird nicht genutzt.

### 3.2 Losung

AfterSavePanel "Teilen" Button offnet die bestehende ShareSheet statt nur den Link zu kopieren. Keine neue Komponente — nur Integration.

**Anderung in `AfterSavePanel.tsx`:**
- Import `ShareSheet`
- State `showShareSheet: boolean`
- "Teilen" Button setzt `showShareSheet = true`
- ShareSheet bekommt `type="event"`, `eventId`, `eventTitle`

### 3.3 Event Detail Share Button

Der Share-Button in `EventDetailActions.tsx` nutzt aktuell nur Web Share API / Clipboard. Auch hier: ShareSheet als Alternative anbieten wenn die Seite geladen ist (Client Component).

---

## 4. Implementierung

### 4.1 Dateiubersicht

| Aktion | Datei |
|---|---|
| Neue API | `src/app/api/venues/[id]/route.ts` — Venue Detail + Events + Similar |
| Neue Seite | `src/app/venues/[id]/page.tsx` — Venue-Detailseite |
| Neue Komponente | `src/components/Venues/VenueDetail.tsx` — Venue-Info-Block |
| Neue Komponente | `src/components/Venues/SimilarVenues.tsx` — Ahnliche Venues |
| Neue Komponente | `src/components/Venues/VenueEventList.tsx` — Events an Venue |
| Editieren | `src/app/events/[id]/page.tsx` — Venue-Link auf `/venues/[id]` statt `/map?venueId=...` |
| Editieren | `src/components/Events/AfterSavePanel.tsx` — ShareSheet statt Clipboard |
| Editieren | `src/app/sitemap.ts` — Venue-URLs |

### 4.2 Venue-Detail Datenlogik

Serverseitig in der Page-Komponente (Server Component):
1. Venue laden via ID
2. Events laden: `venue_id = id`, published, future, quality >= 40, sortiert nach **start_date ASC** (Spielplan-Logik: was kommt als Nachstes?), limit 20
3. Similar Venues: gleicher Typ + gleiche Stadt, nur Venues mit mindestens 1 zukunftigem published Event (quality >= 40), limit 6
4. Event-Count via `count: 'exact'`

Read-Only Client (Anon Key), wie Phase 2/3.

---

## 5. Abgrenzung

**Nicht in Phase 4:**
- Kein Venue-Claiming (Venue-Besitzer pflegen eigenes Profil) — spaeteres Feature
- Keine Venue-Suche/Discovery-Seite (`/venues`) — zu wenig Venues mit Events fur eine eigene Listing-Seite
- Keine Venue-Bilder (User-generiert) — braucht Moderation
- Kein Featured-Status fur Venues
- Kein neues Social-System — nur Integration der bestehenden ShareSheet
- Keine Gruppen-zu-Event-Verknupfung (existiert bereits im Social System)

---

## 6. Akzeptanzkriterien

- [ ] `/venues/[id]` zeigt Venue-Name, Typ, Stadt, Adresse, Website-Link
- [ ] Venue-Seite zeigt kommende Events chronologisch (start_date ASC, quality >= 40)
- [ ] Venue-Seite zeigt FollowVenueButton
- [ ] Venue-Seite zeigt ahnliche Venues (gleicher Typ + Stadt, mit Events)
- [ ] JSON-LD LocalBusiness auf jeder Venue-Seite
- [ ] Meta Tags (title, description, OG) pro Venue
- [ ] Event Detail Venue-Links zeigen auf `/venues/[id]` statt `/map?venueId=...`
- [ ] AfterSavePanel "Teilen" offnet ShareSheet statt nur Clipboard
- [ ] Sitemap enthalt Venue-URLs (nur Venues mit Events)
- [ ] Venues ohne qualifizierende Events (zukunftig, published, quality >= 40) geben 404 zuruck
- [ ] Similar Venues verlinken nur auf Venues die die Verfugbarkeitsregel erfullen
- [ ] Venue-Links auf Event Detail nur wenn Venue qualifiziert (sonst kein Link)
- [ ] `npm run build` kompiliert fehlerfrei
