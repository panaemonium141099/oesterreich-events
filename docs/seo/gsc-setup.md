# Google Setup für `/admin/seo` — Schritt für Schritt

**Projekt-Context**:
- GCP-Projekt: `oesterreich-events`
- Existierender Service-Account: `indexing-api-bot@oesterreich-events.iam.gserviceaccount.com`
- Env-Var in Vercel: `GOOGLE_INDEXING_API_SA_KEY` ✅ schon gesetzt
- Fehlt noch: `CRUX_API_KEY` → siehe Schritt 4

Dauer: ~5 Minuten wenn du dem Text folgst.

---

## Was wir erreichen

Zwei Sachen im GCP-Projekt aktivieren + zwei Zugriffe gewähren:

| Was | Wozu | Wo aktiviert | Wer braucht Zugriff |
|---|---|---|---|
| Search Console API | Dashboard kann Impressionen/Klicks pullen | GCP Library | SA-Email (via GSC-UI) |
| Chrome UX Report API | Dashboard kann Core Web Vitals pullen | GCP Library | API-Key (neu anlegen) |

Merke: **Search Console + Indexing brauchen den Service-Account**. **CrUX braucht einen API-Key**. Das sind zwei verschiedene Auth-Flows bei Google.

---

## Schritt 1 — Search Console API im Projekt enablen

1. Öffne diesen Link (klick, das Projekt ist schon in der URL):
   → https://console.cloud.google.com/apis/library/searchconsole.googleapis.com?project=oesterreich-events
2. Ganz oben links: prüfen dass **"oesterreich-events"** das ausgewählte Projekt ist
3. Blauer **„ENABLE"**-Button klicken
4. Warten bis "API enabled" grün wird (~5s)

Fertig. Keine weiteren Schritte auf dieser Seite.

---

## Schritt 2 — Chrome UX Report API im Projekt enablen

1. Öffne:
   → https://console.cloud.google.com/apis/library/chromeuxreport.googleapis.com?project=oesterreich-events
2. Blauer **„ENABLE"**-Button klicken
3. Warten bis grün

**Wichtig**: Erst wenn diese API enabled ist, erscheint sie später in der API-Restriction-Liste beim API-Key erstellen. Wenn du den Key schon angefangen hast zu erstellen: **„Abbrechen" klicken** und nach Schritt 2+3 neu starten.

---

## Schritt 3 — Service-Account als User auf der GSC-Property addieren

Das ist der Schritt den die meisten vergessen. Ohne den gibt die Search Console API zwar kein „enable"-Error, aber **„403 Forbidden"** für jede Query.

1. Öffne → https://search.google.com/search-console
2. Oben links: die `lasstreffen.at`-Property auswählen
3. Links unten: ⚙ **Einstellungen** → **Nutzer und Berechtigungen**
4. **„Nutzer hinzufügen"**-Button (oben rechts)
5. **E-Mail-Adresse**:
   ```
   indexing-api-bot@oesterreich-events.iam.gserviceaccount.com
   ```
6. **Berechtigung**: *„Eingeschränkt"* (Read-only — wir schreiben nie in GSC)
7. **Hinzufügen**

---

## Schritt 4 — API-Key erstellen (nur für CrUX)

**Wenn du den Key-Creation-Dialog noch offen hast**: Klick „Abbrechen". Die 2 APIs die du vorhin angekreuzt hast (Search Console + Web Search Indexing) brauchen **keinen API-Key** — sie laufen über den SA.

Jetzt frisch:

1. Öffne → https://console.cloud.google.com/apis/credentials?project=oesterreich-events
2. Oben: **„+ ANMELDEDATEN ERSTELLEN"** → **„API-Schlüssel"**
3. Ein Dialog zeigt den neuen Key (AIza…) + **„Schlüssel kopieren"** drücken. Stelle dir den Key in Notepad zwischen, du brauchst ihn in Schritt 5.
4. **„Schlüssel einschränken"** klicken (oder später: auf den Key klicken → „Bearbeiten")
5. **Name**: `CrUX API Key` (zur besseren Lesbarkeit — egal welcher String)
6. Bei **„API-Einschränkungen"**: „Schlüssel einschränken" auswählen
7. Dropdown aufklappen → **NUR „Chrome UX Report API"** ankreuzen, alles andere UNchecken
8. **„Speichern"**

**Wichtig:** Wenn „Chrome UX Report API" nicht in der Liste auftaucht → Schritt 2 noch nicht fertig. Zurück, enablen, dann hier weiter.

---

## Schritt 5 — API-Key in Vercel einfügen

1. Öffne → https://vercel.com/1099s-projects/lasstreffen/settings/environment-variables
2. Oben: **„Add New"** oder das Feld oben am Environment-Variables-Panel
3. **Name**: `CRUX_API_KEY`
4. **Value**: der `AIza…`-String aus Schritt 4.3
5. **Environments**: alle 3 ankreuzen (Production, Preview, Development)
6. **Save**

---

## Schritt 6 — Deploy triggern

Änderung an Env-Vars wirkt **erst nach einem neuen Deploy**. Zwei Wege:

- **Easy**: Vercel → Deployments-Tab → beim aktuellsten "Ready" Deploy → ⋯-Menü → **„Redeploy"**
- **Oder**: irgendwas pushen auf master (auto-deploy läuft dann)

Nach ~2-3 min Build+Deploy ist alles scharf.

---

## Schritt 7 — Verifizieren

1. Öffne → https://lasstreffen.at/admin/seo
2. Am Anfang: **Setup-Banners**. Sollten nach korrektem Setup grün / weg sein.
3. Oben rechts: **„Snapshot jetzt"** klicken → zieht sofort GSC + CrUX Daten, Dashboard populiert sich ohne den täglichen Cron abzuwarten.
4. Kurz scrollen — Overview-Tiles + Keywords + Pages + Vitals sollten jetzt Zahlen haben.

---

## Troubleshooting

| Symptom | Ursache | Lösung |
|---|---|---|
| Banner „Search Console nicht erreichbar" | Schritt 1 oder 3 übersprungen | Beide neu durchgehen |
| Banner „CRUX_API_KEY env var missing" | Schritt 5 nicht deployed | Redeploy triggern (Schritt 6) |
| Alle Widgets leer obwohl Banner grün | Snapshot noch nicht gebaut | „Snapshot jetzt" klicken |
| GSC API Response: 403 „User does not have sufficient permission" | Schritt 3 fehlt (SA ist nicht User auf der Property) | Schritt 3 |
| CrUX API Response: 403 `API_KEY_HTTP_REFERRER_BLOCKED` | API-Key-Restriction ist zu eng (HTTP-Referrer statt API-Restriction) | Key-Edit → Application restrictions auf „Keine" |
| CrUX returns 404 für einzelne URLs | Normal — die Seite hat noch nicht genug Field-Data in Chrome | Kein Fix nötig, Dashboard rendert fallback |

---

## Env-Vars im Projekt (Vollständige Übersicht)

| Env-Var | Für | Status (Stand 2026-04-24) |
|---|---|---|
| `GOOGLE_INDEXING_API_SA_KEY` | Indexing API + Search Console API | ✅ schon gesetzt |
| `CRUX_API_KEY` | Chrome UX Report API | ❌ **fehlt — Schritte 4+5 oben** |
| `CRON_SECRET` | Bearer für Vercel Cron → alle `/api/cron/*` | ✅ schon gesetzt |
| `RESEND_API_KEY` | Email-Versand (Weekly-Report + Traffic-Alert) | ✅ schon gesetzt (fn-10) |
| `ALERT_EMAIL` | Empfänger der SEO-Alerts | ✅ schon gesetzt (fn-10) |

---

## TL;DR

```
Schritt 1 — API enablen:  Search Console API  (Link oben)
Schritt 2 — API enablen:  Chrome UX Report API (Link oben)
Schritt 3 — GSC UI:       SA-Email als Restricted-User auf lasstreffen.at
Schritt 4 — GCP Credentials: + API-Key, nur „Chrome UX Report API" einschränken
Schritt 5 — Vercel:       CRUX_API_KEY=AIza… in Prod+Preview+Dev
Schritt 6 — Redeploy
Schritt 7 — /admin/seo → „Snapshot jetzt" → Daten sichtbar
```
