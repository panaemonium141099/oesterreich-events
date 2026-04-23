# SEO Baseline — Phase 0 artifacts

Dieses Verzeichnis enthält die Baseline-Messung für das Epic
`fn-13-seo-content-parity-vs-wasmachmaat`.

Jede Phase der Epic vergleicht ihre Ergebnisse gegen den ersten Snapshot
(`YYYY-MM-DD-baseline.json`). Ohne diese Zahl gibt es keinen Erfolgs-Nachweis.

## Inhalte

| Datei | Zweck |
|---|---|
| `README.md` | dieses Dokument |
| `keywords-tracking.json` | 50 Queries in 5 Buckets (city_generic, category_bundesland, temporal, occasion_intent, branded_and_longtail) — re-scored wöchentlich |
| `YYYY-MM-DD-baseline.json` | der initiale Snapshot (aus Phase 0) — dient als Referenz für alle Deltas |
| `snapshots/` | append-only Historie aller späteren Snapshots, je eine Datei pro Lauf |

## Snapshot-Script

```bash
npx tsx src/scripts/seo-baseline-snapshot.ts
```

Produziert einen Snapshot mit:

1. **Sitemap-Analyse** — zieht sich `/sitemap.xml` von der Prod-Domain, zählt URLs über alle Sub-Sitemaps (bei Sitemap-Index)
2. **DB-Snapshot** — Events total, future published, coord-Status, Source-Histogramm, Kategorie-Verteilung, Bundesland-Verteilung, Embedding-Coverage, Enrichment-Version-Coverage
3. **Internal-Analytics-Snapshot** — letzte 30 Tage aus `analytics_events`-Tabelle: unique sessions, page-views, top referrers, top pages, event-types
4. **Indexable URL-Inventory** — geschätzte Anzahl aller Seiten die aktuell eine indexbare URL haben (Events, Hubs, Blog, Static Pages)

Der Snapshot ist **read-only** gegen alle externen Systeme und muteriert nichts.
Safe to run repeatedly.

Automatisierbar — zB im GitHub-Actions-Workflow oder als Cron-Job: lege einen Snapshot
täglich ab, damit wir über Wochen einen Graph bekommen wie Indexed URLs wachsen.

## Google Search Console — Setup-Plan

Der Snapshot enthält aktuell ein leeres `search_console`-Objekt, weil die GSC API
erst OAuth-Credentials braucht. Sobald Credentials da sind, wird das Script das
Feld automatisch befüllen.

**Wir brauchen von dir:**

### 1. GSC-Property verifizieren (einmalig)

- Gehe zu https://search.google.com/search-console
- Add Property → URL Prefix: `https://lasstreffen.at`
- Methode: DNS-TXT-Record (bevorzugt) oder HTML-Meta-Tag in `app/layout.tsx`
- Wenn DNS: Verifizierungs-TXT-Record an deinen DNS-Provider schicken
- Wenn Meta-Tag: Ich ergänze den Tag im Layout

### 2. Service Account anlegen (für API-Zugriff)

- Google Cloud Console → IAM → Service Accounts → Create
- Name: `lasstreffen-seo-reader`
- Role: keine Project-Role nötig (nur GSC-Property-Delegation)
- Create JSON Key → Download → als `.env.local` Variable speichern:
  - `GSC_SERVICE_ACCOUNT_EMAIL=xyz@lasstreffen-seo-reader.iam.gserviceaccount.com`
  - `GSC_SERVICE_ACCOUNT_KEY_BASE64=<base64-encoded JSON>`

### 3. Service Account zur GSC-Property hinzufügen

- GSC → Settings → Users and Permissions → Add User
- E-Mail der Service-Account-Adresse aus Schritt 2
- Permission: `Full` oder mindestens `Restricted` (Read-Access reicht uns)

### 4. Installation + Script-Aktivierung

Sobald die Env-Variablen da sind, wird das Snapshot-Script die Zahlen automatisch ziehen.
Wir müssen dann nur:

```bash
npm install googleapis
```

und das `search_console`-Feld im Script mit echter API-Logik befüllen (das mache ich
dann in einem Follow-up-Commit, sobald die Credentials bereit sind).

## Google Analytics 4 — Setup-Plan (optional, später)

Unser internes `analytics_events`-Tracking ist aktuell ausreichend für SEO-Messung.
GA4 wäre nur nötig wenn wir Google Ads-Conversions importieren wollen (→ Phase 8).

Wenn du GA4 parallel willst, zwei Wege:

**Variante A (empfohlen):** Google-Tag (gtag.js) in `app/layout.tsx` einbauen,
`G-XXXXXXXXXX` Measurement-ID als env var. Ich baue das in Phase 8 ein
— im Moment nicht nötig.

**Variante B (komplexer):** GA4 Measurement Protocol server-side — spielt in
unserem `/api/analytics`-Endpoint mit. Besser für Privacy, schwerer zu debuggen.
Auch erst Phase 8.

## Nächste Phase

Phase 1 (URL-Rework auf `/events/[plz]-[ort]/[slug]-[shortid]`) baut auf diesem
Snapshot auf. Jede strukturelle Änderung wird mit einem neuen Snapshot
verglichen um zu sehen ob:

- die Zahl indexierbarer URLs nicht geschrumpft ist
- der Traffic nicht eingebrochen ist
- keine Scraper-Regression passiert ist (events_total / events_by_source bleibt ≥ Baseline)
