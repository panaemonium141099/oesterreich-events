# Event-Schema global korrekt (Zeitzone, eventStatus, i18n)

## Goal & Context
Event-JSON-LD existiert bereits auf der Detailseite, hat aber zwei Fehler, die
Google Rich Results kosten — exakt die zwei, die kleine Portale typischerweise
machen. Gemessen am 2026-09-05 gegen Prod + DB:

1. **startDate ohne korrekte Zeitzone.** Emittiert wird der rohe DB-Wert
   (`2026-10-01T17:00:00+00:00`). Der Event startet real 19:00 Wien. Zusaetzlich
   rendern die sichtbaren Formatter ohne `timeZone`, also serverseitig in UTC —
   die Seite zeigt Googlebot "17:00". Sichtbarer Text != Markup = Rich-Result-Verstoss.
2. **32,5 % aller 71.687 zukuenftigen Events haben gar keine bekannte Uhrzeit**
   und werden trotzdem mit Fake-Uhrzeit ausgeliefert. Zwei Platzhalter-Formen:
   - `T00:00:00Z` (= Wien 02:00), 32,5 % der Zeilen
   - `T22:00:00Z` (= Wien 00:00 am **Folgetag**) — hier ist sogar der **Tag falsch**
3. **eventStatus ist hart auf `EventScheduled`.** Es gibt keine DB-Spalte fuer
   Absagen/Verschiebungen, also kann eine Absage nie gepflegt werden.

## Architecture & Data Models
Neuer reiner Builder `src/lib/seo/event-schema.ts` als Single Source of Truth
fuer Event-JSON-LD (Detailseite heute, Blog-Ticket-Boxen spaeter).

Zeit-Aufloesung (rein, testbar):
- `hasKnownTime(event)` — false bei `is_all_day`, `duration_type='ganztag'`,
  UTC exakt `00:00:00Z`, oder Wien-lokal exakt `00:00`.
- bekannt  -> `startDate: "2026-10-01T19:00:00+02:00"` (Wien-Lokalzeit + Offset)
- unbekannt-> `startDate: "2026-10-01"` (reines Datum, Google-konform statt Fake-Uhrzeit;
  Tag wird aus der **Wien-lokalen** Sicht gebildet, korrigiert damit den Tagesversatz)

DB-Migration: `events.event_status` (text, default 'scheduled', CHECK auf
scheduled|cancelled|postponed|rescheduled|moved_online) + `previous_start_date`
(timestamptz, nur bei rescheduled). Builder degradiert sauber, wenn Spalte fehlt.

## API Contracts
`buildEventJsonLd(event, { locale }): Record<string, unknown>`
- `inLanguage`: 'de' | 'en'
- URL/offers.url: `/en`-Prefix auf der EN-Seite
- eventStatus-Mapping inkl. `previousStartDate` bei rescheduled,
  `eventAttendanceMode = OnlineEventAttendanceMode` bei moved_online
- Absagen bleiben indexierbar (Google verlangt, dass die Seite live bleibt)

PATCH `/api/admin/events/[id]/event-status` — analog zur bestehenden
`publish-status`-Route.

## Edge Cases & Constraints
- Echtes 02:00-Event wird als date-only ausgeliefert: Tag bleibt korrekt,
  nur die Uhrzeit entfaellt. Bewusst akzeptiert.
- DST: Offset per `Intl` pro Datum, nie hartkodiert (+01:00 vs +02:00).
- `publish_status='published_low_confidence'` emittiert weiterhin kein Schema.
- Kein Backfill noetig — Fix greift zur Renderzeit fuer alle 71.687 Events.

## Acceptance Criteria
- [ ] startDate traegt Wien-Offset (+02:00/+01:00), nie mehr blind +00:00
- [ ] Events ohne bekannte Uhrzeit liefern date-only startDate am korrekten Tag
- [ ] Sichtbare Uhrzeit auf der Detailseite == JSON-LD-Uhrzeit (Europe/Vienna)
- [ ] eventStatus aus DB, inkl. previousStartDate bei rescheduled
- [ ] JSON-LD auf /en traegt inLanguage=en und /en-URLs
- [ ] Unit-Tests fuer alle Zeit-/Status-Faelle gruen

## Boundaries
Kein Re-Scrape, kein Backfill der Uhrzeiten, kein Admin-UI (nur API-Route).
Andere Schema-Typen (LocalBusiness, TouristAttraction, BlogPosting) unveraendert.

## Decision Context
Uhrzeit-Praezision wird zur Renderzeit inferiert statt persistiert: die
Pipeline berechnet zwar `startPrecision`, verwirft sie aber beim Write.
Eine neue Spalte + Backfill ueber 280k Zeilen waere teurer und langsamer als
die Inferenz aus zwei eindeutigen Platzhalter-Formen.
