# Funnel Phase 5: Trigger- und Messaging-Maschine

## Goal & Context

Aus gespeicherten Werten regelmasige Ruckkehr machen. Jede persistente Praferenz (gefolgte Stadt, gefolgte Venue, gespeichertes Event, Artist-Follow, Studenten-Modus) soll zu einem Ruckkehr-Trigger werden. Die Plattform wird damit vom Suchtool zum Begleiter.

**Referenz:** Bericht 2 — Abschnitt 10, Phase 5 + Abschnitt 7 (Umsetzungsarchitektur, Ebene 3: Trigger-Maschine)

**Approach:** Aufbau auf bestehender Infrastruktur (Resend Email, Twilio SMS, Supabase Realtime, Edge Functions). Kein neues Notification-System — die Kanale existieren, die Trigger-Logik fehlt.

---

## 1. Was bereits existiert

| Komponente | Status |
|---|---|
| Email-Service (Resend API) | Funktioniert (Artist-Alerts) |
| SMS-Service (Twilio API) | Funktioniert (Artist-Reminders) |
| In-App Notifications (Realtime) | Funktioniert (Bell + Toast) |
| Notification Preferences API | Funktioniert (GET/PUT) |
| Unsubscribe Endpoint (GDPR) | Funktioniert |
| Email-Templates (Artist Alert/Reminder) | Vorhanden |
| Artist-Matching Edge Function (pg_cron 5min) | Aktiv |
| send-reminders Edge Function | **Vorhanden, Email/SMS stubbed** |
| `event_reminders` Tabelle | Vorhanden |
| `followed_cities` Tabelle (Phase 1) | Vorhanden |
| `followed_venues` Tabelle (Phase 1) | Vorhanden |
| `followed_artists` Tabelle | Vorhanden |
| `notification_preferences` Tabelle | Vorhanden |
| `profiles.preferred_bundesland` | Vorhanden |
| `profiles.preferred_categories` | Vorhanden |

**Was fehlt:**
- City Digest Trigger (wochentlich)
- Venue New-Event Trigger
- "Heute in deiner Gegend" Trigger
- Studenten Do/Fr Alert Trigger
- Profil-Erweiterung (preferred_city kanonisch, student_mode)
- send-reminders Email/SMS aktivieren (Stubs → echte Calls)
- Notification Preferences UI
- Delivery Log fur Idempotenz

---

## 2. Delivery Log: Idempotenz-Schicht

### 2.1 Problem

Cron-Jobs konnen retries haben, doppelt laufen, oder bei Fehlern teilweise ausfuhren. Ohne Delivery-Tracking werden Notifications doppelt gesendet. `last_city_digest_at` auf profiles ist zu grob — es fehlt Granularitat pro Trigger-Typ, Entity und Kanal.

### 2.2 Neue Tabelle: `notification_deliveries`

```sql
CREATE TABLE notification_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trigger_type    text NOT NULL,        -- 'city_digest', 'venue_alert', 'today_near_you', 'student_alert', 'reminder_7d', 'reminder_1d'
  entity_key      text NOT NULL,        -- z.B. "wien:steiermark", venue_id, event_id — identifiziert das Objekt
  channel         text NOT NULL,        -- 'in_app', 'email', 'sms'
  time_bucket     text NOT NULL,        -- ISO date oder Woche z.B. "2026-04-09", "2026-W15"
  sent_at         timestamptz DEFAULT now(),
  UNIQUE(user_id, trigger_type, entity_key, channel, time_bucket)
);

CREATE INDEX idx_notification_deliveries_lookup
  ON notification_deliveries(user_id, trigger_type, time_bucket);

ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own deliveries"
  ON notification_deliveries FOR SELECT
  USING (auth.uid() = user_id);
```

### 2.3 Idempotenz-Logik

Vor jedem Versand pruft die Edge Function:

```sql
SELECT 1 FROM notification_deliveries
WHERE user_id = $1
  AND trigger_type = $2
  AND entity_key = $3
  AND channel = $4
  AND time_bucket = $5;
```

Wenn Eintrag existiert → nicht nochmal senden. Nach erfolgreichem Versand → INSERT.

**Time-Bucket Definitionen:**

| Trigger | Time-Bucket Format | Beispiel |
|---|---|---|
| City Digest | ISO-Woche | `2026-W15` |
| Venue Alert | ISO-Datum | `2026-04-09` |
| Today Near You | ISO-Datum | `2026-04-09` |
| Student Alert | ISO-Datum | `2026-04-10` |
| Reminder 7d | Event-ID (einmalig) | `evt_abc123` |
| Reminder 1d | Event-ID (einmalig) | `evt_abc123` |

Damit werden Retries, doppelte Cron-Laufe und partielle Fehler sauber abgefangen.

---

## 3. Trigger-Typen

### 3.1 Ubersicht

| Trigger | Ausloeser | Frequenz | Kanal |
|---|---|---|---|
| **City Digest** | Gefolgte Stadt hat neue Events | Wochentlich (Mo 09:00 CET) | Email |
| **Venue Alert** | Gefolgte Venue hat neues Event | Post-Ingest (eigene Edge Fn) | In-App + Email |
| **Heute in deiner Nahe** | User hat preferred_city | Taglich 10:00 CET | In-App + Email |
| **Student Do/Fr** | User hat student_mode=true | Do 16:00 + Fr 14:00 CET | In-App + Email |
| **Event Reminder** | User hat Reminder gesetzt | 7d + 1d vor Event | In-App + Email + SMS |
| **Artist Match** | Neuer Artist-Match gefunden | Bei Match-Fund | In-App + Email |

**Alle Zeiten in Europe/Vienna.** Die Edge Functions verwenden `Intl.DateTimeFormat('de-AT', { timeZone: 'Europe/Vienna' })` fur Tageszuordnung. Cron-Expressions laufen in UTC, die interne Logik rechnet in Wiener Lokalzeit. DST-sichere Fenster: Trigger feuern in einem 2-Stunden-Fenster (z.B. 09:00-11:00 CET), Idempotenz per Time-Bucket verhindert Doppelsendung.

### 3.2 City Weekly Digest

**Logik:**
1. Fur jeden User mit `followed_cities` Eintraegen und `city_digest_enabled=true`
2. Lade Top-5 Events pro Stadt (published, future, quality >= 50, sortiert nach event_score DESC)
3. **"Neu seit letztem Digest":** Der letzte Digest-Zeitpunkt wird aus `notification_deliveries` abgeleitet:
   ```sql
   SELECT MAX(sent_at) FROM notification_deliveries
   WHERE user_id = $1 AND trigger_type = 'city_digest' AND entity_key = $2;
   ```
   Wenn kein Eintrag existiert (erster Digest): Events der letzten 7 Tage (`created_at > now() - interval '7 days'`).
4. Wenn keine neuen Events: kein Digest senden
5. Idempotenz: `notification_deliveries` mit `time_bucket = ISO-Woche` (z.B. `'2026-W15'`)

### 3.3 Venue New-Event Alert

**Logik:**
1. Neue Events mit `venue_id` das in `followed_venues` vorkommt
2. In-App Notification + optional Email
3. Batching: maximal 1 Alert pro Venue pro Tag
4. Idempotenz: `entity_key = venue_id`, `time_bucket = '2026-04-09'`

**Implementierung:** Eigene Edge Function `process-new-events` (nicht in match-artists eingebaut). Wird nach Scraper-Lauf aufgerufen. Fachlich getrennt von Artist-Matching.

### 3.4 "Heute in deiner Nahe"

**Logik:**
1. Fur jeden User mit `preferred_city_slug` + `preferred_bundesland` und `today_near_you_enabled=true`
2. Lade Top-3 Events fur heute in der Stadt (published, quality >= 50)
3. Nur senden wenn mindestens 1 Event vorhanden
4. Idempotenz: `time_bucket = '2026-04-09'`

### 3.5 Student Thursday/Friday Alerts

**Logik:**
1. Fur jeden User mit `student_mode=true` und `student_alerts_enabled=true`
2. Lade Top-3 studentisch relevante Events fur heute Abend (via `computeStudentScore()` >= 15)
3. Donnerstag + Freitag (Europe/Vienna Wochentag)
4. Idempotenz: `time_bucket = '2026-04-10'`

### 3.6 Event Reminders

**Logik:**
1. `event_reminders` mit `sent=false` und `remind_at <= now()`
2. Pro Reminder: sende uber alle aktivierten Kanale
3. Kanal-Versand wird einzeln in `notification_deliveries` getrackt

**Sendemarkierungen pro Kanal + Offset:**

Jeder Reminder-Versand wird in `notification_deliveries` getrackt:
- `trigger_type = 'reminder_7d'` oder `'reminder_1d'`
- `entity_key = event_id`
- `channel = 'in_app'` / `'email'` / `'sms'`

Damit wird pro Kanal und Offset (7d/1d) exakt einmal gesendet, auch wenn der Cron mehrfach lauft.

**`event_reminders.sent` Semantik:**

`event_reminders.sent` wird **nur auf `true` gesetzt wenn mindestens ein Kanal erfolgreich gesendet wurde** (In-App zahlt immer). Das Feld dient als grober "diesen Reminder verarbeitet"-Marker fur die Cron-Query (`WHERE sent=false`). Die Wahrheit pro Kanal liegt in `notification_deliveries`.

Ablauf bei teilweisem Versandfehler:
1. In-App erfolgreich → `notification_deliveries` INSERT fur in_app
2. Email erfolgreich → INSERT fur email
3. SMS fehlgeschlagen → kein INSERT fur sms
4. `event_reminders.sent = true` (mindestens 1 Kanal erfolgreich)
5. Nachster Cron-Lauf: Reminder wird nicht mehr selektiert
6. SMS-Retry ist explizit nicht vorgesehen — bei SMS-Fehler wird nicht erneut versucht (SMS ist best-effort)

Damit gibt es keinen Zustand wo ein halb-gesendeter Reminder endlos re-prozessiert wird.

---

## 4. SMS Opt-in Regeln

**Harte Regeln fur SMS-Versand:**

1. Kein SMS ohne valide E.164 Nummer in `notification_preferences.phone_number`
2. Kein SMS ohne `channel_sms = true` (explizites Opt-in)
3. Bei fehlender oder invalider Nummer: SMS-Kanal wird ubersprungen (kein Error, kein Retry)
4. Telefonnummer-Validierung bei Eingabe (Regex: `^\+43[0-9]{8,12}$` fur osterreichische Nummern)
5. SMS nur fur Event Reminders (1d, 7d) — nicht fur Digests oder Alerts (zu haufig)

---

## 5. Profil-Erweiterung

### 5.1 Neue Felder in `profiles` Tabelle

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_city_slug text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_city_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_mode boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nightlife_preference boolean DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS max_distance_km integer;
```

`preferred_city_slug` + `preferred_bundesland` (existiert bereits) bilden den kanonischen City-Key — identisch mit der Struktur in `followed_cities` und `landing-slugs.ts`. Das Dropdown auf der Profil-Seite bietet nur Stadte aus `LANDING_CITIES` + `STUDENT_CITIES` an.

**Kein `last_city_digest_at` / `last_today_alert_at`** auf profiles — Idempotenz lauft uber `notification_deliveries`.

### 5.2 Profil-Seite Erweiterung

Bestehende `/profile` Seite bekommt neue Sektion "Benachrichtigungen":
- preferred_city Dropdown (aus LANDING_CITIES + STUDENT_CITIES, setzt slug + name)
- student_mode Toggle
- Notification-Kanal Toggles (In-App, Email, SMS)
- Trigger-Toggles (City Digest, Venue Alerts, Today Near You, Student Alerts)
- Reminder-Praferenzen (7d, 1d)
- Telefonnummer-Eingabe mit E.164 Validierung (nur sichtbar wenn SMS aktiv)

---

## 6. Email-Templates

### 6.1 Neue Templates

| Template | Datei | Inhalt |
|---|---|---|
| City Digest | `src/emails/city-digest.tsx` | "{count} neue Events in {city}" + Event-Liste |
| Venue Alert | `src/emails/venue-alert.tsx` | "Neues bei {venue}: {event}" |
| Today Near You | `src/emails/today-near-you.tsx` | "Heute in {city}: {count} Events" |
| Student Alert | `src/emails/student-alert.tsx` | "Heute Abend fur Studenten: {count} Events" |

### 6.2 Template-Struktur

Alle Templates folgen dem bestehenden Muster aus `artist-alert.tsx`:
- Inline CSS (kein Tailwind in Emails)
- Unsubscribe-Link mit HMAC-Token
- Preferences-Link
- Event-Cards mit Bild, Titel, Datum, Ort, Ticket-Link

---

## 7. Edge Functions

### 7.1 send-reminders aktivieren

Die bestehende `send-reminders` Edge Function hat Email/SMS als Stubs. Diese werden aktiviert:
- Email: Nutzt `sendArtistAlertEmail()` Pattern aus `src/lib/email.ts`
- SMS: Nutzt `sendArtistAlertSms()` Pattern aus `src/lib/sms.ts`
- **SMS nur senden wenn:** `channel_sms=true` UND `phone_number` valide E.164
- **Idempotenz:** Vor Versand `notification_deliveries` prufen, nach Versand INSERT
- pg_cron Schedule aktivieren: `0 * * * *` (stundlich)

### 7.2 Neue Edge Function: `send-digests`

Verarbeitet alle nicht-Echtzeit-Trigger:
- City Weekly Digest (Montag 09:00 CET)
- Today Near You (taglich 10:00 CET)
- Student Do/Fr Alerts (Do 16:00, Fr 14:00 CET)

**Logik:**
1. Berechne aktuelle Wiener Lokalzeit via `Intl.DateTimeFormat`
2. Prufe welche Trigger im aktuellen Fenster fallig sind
3. Fur jeden falligen Trigger: lade betroffene User (mit Preference-Check)
4. Prufe Idempotenz via `notification_deliveries`
5. Generiere + sende Notifications per aktiviertem Kanal
6. INSERT in `notification_deliveries`

**pg_cron:** Lauft stundlich (`0 * * * *`). Interne Zeitlogik entscheidet welche Trigger feuern.

### 7.3 Neue Edge Function: `process-new-events`

Verarbeitet Venue-Alerts nach Event-Ingest. Fachlich getrennt von Artist-Matching.

**Logik:**
1. Wird vom Post-Scrape Hook aufgerufen mit der `scrape_run_id` als Parameter
2. Lade Events mit `venue_id IS NOT NULL` die zu diesem Scrape-Run gehoren:
   ```sql
   SELECT DISTINCT e.venue_id, e.id, e.title
   FROM events e
   WHERE e.source_name = $scraper_source_name
     AND e.created_at >= $scrape_run_started_at
     AND e.venue_id IS NOT NULL
     AND e.publish_status = 'published';
   ```
   Die `scrape_run_id` liefert `source_name` und `started_at` aus der `scrape_runs` Tabelle — damit ist der Delta-Scan deterministisch und unabhangig von einem globalen `last_run` Cursor.
3. Lookup `followed_venues` fur betroffene User
4. Prufe `venue_alerts_enabled=true` in Preferences
5. Prufe Idempotenz via `notification_deliveries` (entity_key=venue_id, time_bucket=ISO-Datum)
6. Erstelle In-App Notification + optional Email
7. INSERT in `notification_deliveries`

**Aufruf:** Post-Scrape Hook ubergibt `scrape_run_id` als Parameter. Kein eigener Cursor/Checkpoint notig.

---

## 8. Implementierung

### 8.1 Dateiubersicht

| Aktion | Datei |
|---|---|
| Migration | `notification_deliveries` Tabelle + RLS |
| Migration | `profiles` erweitern (preferred_city_slug, student_mode, etc.) |
| Migration | `notification_preferences` erweitern (Trigger-Toggles) |
| Neue Email | `src/emails/city-digest.tsx` |
| Neue Email | `src/emails/venue-alert.tsx` |
| Neue Email | `src/emails/today-near-you.tsx` |
| Neue Email | `src/emails/student-alert.tsx` |
| Neue Edge Fn | `supabase/functions/send-digests/index.ts` |
| Neue Edge Fn | `supabase/functions/process-new-events/index.ts` |
| Neue Komponente | `src/components/Notifications/NotificationSettings.tsx` |
| Editieren | `supabase/functions/send-reminders/index.ts` — Email/SMS aktivieren + Idempotenz |
| Editieren | `src/app/api/notifications/preferences/route.ts` — neue Felder |
| Editieren | `src/app/profile/page.tsx` — NotificationSettings einbinden |

---

## 9. Abgrenzung

**Nicht in Phase 5:**
- Keine Push-Notifications (Web Push API) — braucht Service Worker + Browser-Permission
- Kein WhatsApp-Kanal — braucht WhatsApp Business API
- Keine personalisierte Event-Empfehlung (ML-basiert) — zu komplex
- Keine Echtzeit-Venue-Alerts (nur nach Scraper-Lauf, nicht sofort)
- Kein A/B-Testing fur Email-Betreffzeilen
- Keine Email-Open-Rate-Tracking (kommt spater)
- Keine SMS-Verifikation (OTP) — Validierung reicht fur Phase 5

---

## 10. Akzeptanzkriterien

- [ ] `notification_deliveries` Tabelle existiert mit korrektem Schema + RLS
- [ ] Jeder Trigger pruft Idempotenz via `notification_deliveries` vor Versand
- [ ] City Weekly Digest wird Montags an User mit gefolgten Stadten + Opt-in gesendet
- [ ] Venue Alert wird nach Scraper-Lauf an User mit gefolgten Venues + Opt-in gesendet
- [ ] Venue Alerts laufen in eigener Edge Function (nicht in match-artists)
- [ ] "Heute in deiner Nahe" wird taglich an User mit preferred_city + Opt-in gesendet
- [ ] Student Do/Fr Alert wird an User mit student_mode=true + Opt-in gesendet
- [ ] Event Reminders (1d, 7d) senden Email + SMS (nicht nur In-App)
- [ ] Reminder-Sendung wird pro Kanal + Offset in `notification_deliveries` getrackt
- [ ] SMS wird nur gesendet bei: channel_sms=true UND valider E.164 Nummer
- [ ] SMS wird nur fur Reminders verwendet, nicht fur Digests/Alerts
- [ ] Alle Trigger respektieren Notification Preferences (Kanal + Trigger Toggles)
- [ ] Keine Benachrichtigung wenn keine relevanten Events vorhanden
- [ ] preferred_city nutzt kanonischen Slug (nicht freier Text)
- [ ] Profil-Seite zeigt NotificationSettings mit preferred_city Dropdown, student_mode, Kanal-Toggles
- [ ] Email-Templates haben Unsubscribe-Link
- [ ] Zeitlogik verwendet Europe/Vienna fur alle Trigger-Fenster
- [ ] pg_cron Schedules sind aktiv fur send-reminders, send-digests
- [ ] `npm run build` kompiliert fehlerfrei
