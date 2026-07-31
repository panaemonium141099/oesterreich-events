# Smart-Suche 2.0 — Concierge-Tagesplaner (Chat) + Sichtbarkeit & Messbarkeit

## Goal & Context

Die Smart-Suche soll der Verkaufsschlager der Plattform werden: eine KI, die aus dem echten Datenbestand (~300k Events + zehntausende `poi_activities`) konkrete, verlinkte Empfehlungen und Tagesplaene baut — statt generischer Tipps. Kein Mitbewerber kann "Was mache ich Samstag mit meinen Eltern in Graz bei Regen?" mit echtem Bestand beantworten; der Moat sind die Daten, nicht die KI.

**Ist-Zustand (verifiziert 2026-07-31 gegen origin/master):** Das DB-Grounding existiert seit fn-18.6 — `contentTypes`/`activityMatches` in `/api/search/semantic`, `search_activities`-RPC, UI-Block "Passende Aktivitaeten", Concierge-Prompt enthaelt Top-5 Events + Top-5 Aktivitaeten. Was fehlt:

- (a) **Follow-ups/Chat** — heute Einmal-Query, jede Suche ersetzt das Ergebnis komplett
- (b) **eigenstaendiger DB-Zugriff der KI** (Tool-Calling) statt Top-5-Passthrough vom Client
- (c) **Messbarkeit** — 0 Analytics auf dem gesamten Smart-Stack (git grep verifiziert)
- (d) **Schutz** — kein Rate-Limit, kein Cache auf beiden Search-Routen
- (e) **Sichtbarkeit** — einziger Einstieg ist der Tab auf /entdecken; kein einziger Deep-Link mit ?mode=smart existiert; Top-Nav/Landing/Hubs fuehren alle in den Listen-Modus

**User-Entscheidungen 2026-07-31:** Phasenplan A→B; sanfter Einstieg ueber CTAs (Top-Nav-Suche bleibt Listen-Suche).

## Architecture & Data Models

### Phase A — Fundament & Sichtbarkeit (eigenstaendig shippable)

1. **Analytics auf dem gesamten Smart-Stack** (Infrastruktur existiert: `trackEvent()` + globaler ClickTracker):
   `smart_search` (query, eventCount, activityCount, aiPath vs. Fallback), `concierge_shown`, `concierge_citation_click`, `smart_result_click` (entity_type event|activity, id), `smart_cta_click`.
2. **Schutz:** Best-effort-Rate-Limit pro IP auf `/api/search/semantic` + `/api/search/concierge` (in-memory pro Instanz, bewusst — Upstash erst bei Wachstum, Masterplan §9.1) + kurzer In-Memory-Cache fuer identische normalisierte Queries (15 min, LRU, best effort).
3. **Verstehens-UI:** die geparsten Signale (Datum, Ort, Preis, contentTypes) als entfernbare Chips ueber den Ergebnissen (Chip entfernen = Re-Query ohne das Signal). Trust-Anker: "durchsucht {n} Events & {m} Aktivitaeten" — Zahlen aus `event_stats_cache` bzw. gerundet statisch, NIEMALS `count(*) exact`.
4. **CTAs (sanfter Einstieg):** Landing-Sektion unter dem Hero, Gemeinde-/Thema-Hubs ("Frag die KI: Was geht in {Ort}?" → `/entdecken?mode=smart&q=...` vorbefuellt), /aktivitaeten, sowie Hinweis im Listen-Tab bei 0 Treffern. Alle mit `data-track="smart_cta"`.

### Phase B — Concierge-Chat / Tagesplaner (der Wow-Faktor)

1. **Neue Route `POST /api/search/chat`** (SSE, stateless): Body `{ messages: [{role, content}], locale? }`, Caps: max 12 Messages a 500 Zeichen. Gemini 2.5 Flash mit **Function-Calling**; Tools `search_events(intent)` + `search_activities(intent)` = duenne Wrapper um die BESTEHENDEN Retrieval-Funktionen der Semantic-Route (gleiche Whitelist-Validierung, gleiche Limits, gleiche Indizes). Max 4 Tool-Runden, danach Zwangs-Antwort. Google-Grounding bleibt als Zusatz fuer externe Tipps (Bars/Restaurants), klar als Web-Tipp markiert (Citations wie heute).
2. **Antwortformat:** Stream mit Text-Deltas + strukturierten Entity-Bloecken. Das Modell referenziert Entitaeten per stabiler Kennung aus den Tool-Ergebnissen (z. B. `[event:ID]` / `[activity:SLUG]`); der Server streamt dafuer `entity`-SSE-Events mit Karten-Daten (Titel, Bild, Datum, Ort, Link, Ticket-CTA). Die UI rendert echte, klickbare Karten im Antwort-Fluss — ein Tagesplan ist Text mit eingebetteten DB-Entitaeten.
3. **UI Smart-Tab wird Chat:** Verlauf client-seitig (sessionStorage, KEIN Server-State), Follow-up-Chips ("eher indoor", "guenstiger", "mit Kindern", "am Abend"), `?q=` startet den Chat abwaertskompatibel mit dieser Frage. Ergebnis-Grid der letzten Antwort bleibt unterhalb erhalten.
4. **Monetarisierung:** `is_boosted`-Events werden in Tool-Ergebnissen markiert und in der Antwort als "Anzeige" gekennzeichnet bevorzugt; Event-Karten im Chat tragen den Eventim-Ticket-CTA (`ticket_click`); Aktivitaets-Karten zeigen den `affiliate_product`-Slot, sobald fn-18.5 (Viator/GYG) live ist.
5. **"Als Plan speichern" (User-Wunsch 2026-07-31):** Sobald eine Chat-Antwort >=1 Event-Entitaet enthaelt, zeigt die Antwort einen CTA "Als Plan speichern". Er erzeugt via bestehendem `POST /api/plans` einen Plan (name = KI-generierter Kurztitel des Tagesplans, plan_date = erkanntes Datum bzw. Datum des fruehesten Events, event_ids = alle Event-Entitaeten der Antwort in Empfehlungs-Reihenfolge). Aktivitaeten: `plan_items` kennt heute nur `event_id` — MVP schreibt empfohlene Aktivitaeten als verlinkte Zeilen in die Plan-`note`; die saubere Schema-Erweiterung (`plan_items.activity_id` nullable + CHECK genau-eins-von) ist eigener Task und darf nachziehen. Anonyme Nutzer: CTA fuehrt zum Login und kehrt zurueck (Chat-Verlauf liegt in sessionStorage, gleicher Tab = kein Verlust); danach Weiterleitung auf `/plan/[id]` (Share-Link/Reminder uebernimmt das bestehende Plan-Feature).

## API Contracts

- `/api/search/semantic`: **unveraendert** (Vertrag fn-18.6/E9 bleibt; SCORE_ORDER-/EXPLAIN-Kommentare und `filter_after_date >= NOW()`-Invariante unantastbar).
- `/api/search/concierge`: Phase A unveraendert; nach B-Launch vom Chat abgeloest (Route bleibt als Fallback, bis die UI vollstaendig umgestellt ist).
- **NEU** `/api/search/chat`: `POST { messages[], locale? }` → SSE-Events `text {delta}`, `entity {type, id|slug, card}`, `done {citations[]}`, `error {message}`; 429 bei Rate-Limit; kein Auth-Zwang.
- Analytics: neue event_types in `analytics_events`: `smart_search`, `smart_result_click`, `concierge_shown`, `concierge_citation_click`, `smart_cta_click`; Phase B zusaetzlich `chat_message`, `chat_followup`, `chat_save_plan`.
- `POST /api/plans`: **unveraendert** (bestehender Vertrag: name + plan_date + event_ids[], Auth-Pflicht 401). Der Chat-Client konsumiert ihn nur. Optionale spaetere Migration `plan_items.activity_id` (nullable, CHECK genau-eins-von event_id/activity_id) als eigener Task.

## Edge Cases & Constraints

- **Supabase Micro:** Tools nutzen NUR bestehende indexierte Pfade + Limits (60/Query); keine neuen Scans, kein `count exact`. Chat maximal 4 Tool-Runden x 3 parallele Queries.
- **Gemini-Ausfall/Timeout:** Chat degradiert auf den heutigen deterministischen Semantic-Fallback (eine Antwort + Ergebnis-Grid, keine Konversation). Concierge-/Chat-Fehler duerfen die Ergebnisliste NIE blockieren (heutiges Auto-Hide-Muster beibehalten).
- **Kosten:** Flash-Call ~0,02 Cent, grounded ~0,7 Cent; Chat-Session mit 3 Follow-ups ≈ 4–8 Calls. Rate-Limit (Groessenordnung 10 Nachrichten/min/IP, best effort) + Message-Caps deckeln; Monitoring ueber die neuen Analytics-Events.
- **Prompt-Injection:** Tool-Ergebnisse sind Daten, keine Instruktionen; Systemprompt-Regeln wie heute (keine erfundenen Eigennamen; Empfehlungen nur aus Tool-Ergebnissen oder markierten Grounding-Quellen).
- **i18n (fn-17):** UI-Strings via next-intl; Chat antwortet in der locale; /en/entdecken funktioniert identisch.
- **Past-Events:** `filter_after_date >= NOW()` gilt auch fuer alle Tools (Memory semantic_search_future_only). Aktivitaeten sind datumslos — kein Datumsfilter im Activity-Pfad (fn-18.6-Vertrag).
- **Branch-Hinweis:** fn-18.6/.7/.8 liegen auf origin/master, NICHT auf feat/i18n-rest — Arbeit an diesem Epic zweigt von origin/master ab.

## Acceptance Criteria

Phase A:
- [ ] `analytics_events` enthaelt smart_search/smart_result_click/concierge_shown/smart_cta_click mit Payloads (per DB-Query nach manuellem Test verifiziert)
- [ ] 429 nach Ueberschreiten des Limits; identische Query innerhalb 15 min trifft den Cache (Test/Log-Beleg)
- [ ] Parsed-Chips sichtbar + entfernbar (Re-Query ohne das Signal); Trust-Anker mit echten Zahlen ohne `count(*) exact`
- [ ] CTAs auf Landing, Gemeinde-Hub, Thema-Hub fuehren mit vorbefuellter Query in den Smart-Tab; alle getrackt
- [ ] Bestehende semantic-/smart-query-Tests unveraendert gruen (kein Vertrags-Drift)

Phase B:
- [ ] Follow-up ("eher indoor") verfeinert das vorige Ergebnis nachweislich (neue Tool-Calls mit verfeinertem Intent, z. B. setting-Filter)
- [ ] Chat-Antwort enthaelt verlinkte Event- UND Aktivitaets-Karten aus der DB (entity-SSE-Events); externe Tipps nur mit Quelle + Markierung
- [ ] Server stateless: Verlauf kommt vom Client; Caps (12 Msg x 500 Zeichen, 4 Tool-Runden) enforced + getestet
- [ ] Boosted Events als "Anzeige" markiert; Ticket-CTA im Chat feuert `ticket_click`
- [ ] "Als Plan speichern": eingeloggt entsteht ein Plan mit allen Event-Entitaeten der Antwort (Reihenfolge = Empfehlung) + Aktivitaeten in der note; anonym fuehrt der CTA zum Login und der Chat-Verlauf ist nach Rueckkehr intakt; `chat_save_plan` getrackt
- [ ] Vitest: Tool-Dispatcher (Whitelist, Caps), SSE-Parser der UI, Degradations-Pfad ohne GEMINI_API_KEY
- [ ] Kein Regressions-Diff im Vertrag von `/api/search/semantic`

## Boundaries

- KEINE Embeddings/pgvector, kein per-Event-Enrichment (Masterplan §6)
- Top-Nav-Suche bleibt Listen-Suche (User-Entscheidung "sanfter Einstieg", 2026-07-31)
- Kein server-seitiger Chat-Verlauf, kein Login-Zwang, keine Personalisierung aus User-Daten in diesem Epic
- fn-18.5 (Viator/GYG-Monetarisierung) bleibt eigener Task in fn-18 — hier nur der Anzeige-Slot auf der Aktivitaets-Karte
- Social-Features unberuehrt; keine Aenderungen an /map

## Decision Context

- **Warum kein RAG/Embeddings:** der 1,22-GB-pgvector-Index mit 50 Scans wurde 2026-07-07 bewusst entsorgt; Taxonomie-Intent + indexierte Queries sind nie stale und skalieren mit Suchvolumen statt Datenbestand (Masterplan §6).
- **Warum Tool-Calling statt groesserem Passthrough:** Follow-ups brauchen neue Queries; das Modell soll selbst nachfassen ("indoor" → setting-Filter), ohne dass der Client Intent-Logik dupliziert. Die Retrieval-Funktionen existieren und bleiben die einzige DB-Zugriffsschicht.
- **Warum Phasen:** A liefert Messbarkeit + Sichtbarkeit sofort und beweist den Wert mit Zahlen (auch fuers B2B-/Outreach-Argument), B baut den Wow-Faktor auf gemessener Basis. Beide Phasen einzeln shippable.
- **User-Entscheidungen 2026-07-31** (AskUserQuestion): Phasenplan A→B; sanfter CTA-Einstieg statt Top-Nav-Umbau.
