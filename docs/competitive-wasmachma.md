# Competitive Intel: wasmachma.at

> **Erhoben am:** 2026-04-23
> **Quelle:** 4 parallele Research-Agenten + direkte WebFetch-Analyse
> **Kontext:** Direkte Competitor-Analyse zu lasstreffen.at

---

## TL;DR — Wer ist das

**WasMachMa™** ist eine **Ein-Mann-Bude** betrieben von **Jürgen Koller B.A. (Hons.)**, Blumengasse 12, 7221 Marz, Burgenland (~4.000 Einwohner, Bezirk Mattersburg).

- **Gegründet:** 2025
- **Rechtsform:** natürliche Person mit WKO-Gewerbe (NICHT GmbH/e.U./Verein)
- **Keine physische Adresse im Impressum** (offloaded zu WKO-ECG-Link), **keine UID-Nummer** angegeben — juristisch dünn
- **Android-App:** `at.wasmachma.app` (nur Android, kein iOS)
- **Stack:** Apache + PHP + jQuery 3.6.0 — **2015-Ära**, kein Next.js, kein React, kein modernes Framework
- **Eigene Aussage in AGB § 8:** "Dieses Portal wird nicht von einem großen Unternehmen betrieben, sondern von einer einzelnen Privatperson."

**Übersetzung:** Ihr seid strukturelle Peers. Er ist genauso Solo-Founder wie du, sitzt sogar im gleichen Bundesland.

---

## 1. Tech-Stack (ihre Schwäche)

| Bereich | wasmachma.at | lasstreffen.at |
|---|---|---|
| Server | Apache auf VPS | Vercel Edge |
| Backend | PHP | Next.js 16 API Routes |
| Frontend | jQuery 3.6.0 | React 19 + Tailwind v4 |
| DB | unbekannt (sequential int IDs → MySQL wahrscheinlich) | Supabase PostgreSQL + pg_trgm |
| Map | Leaflet + OpenStreetMap | Mapbox GL JS |
| Caching | `Cache-Control: no-store` (!) | Vercel Edge Cache |
| Auth | kein User-System | Supabase Auth (Google + Email) |

**Was das bedeutet:** Sie können keine Social Features bauen, keine Real-Time-Updates, keine Artist-Matching-Queries, keine Push-Notifications. Dein Stack ist eine Generation voraus.

---

## 2. DATENQUELLEN — Das Goldstück

**Ihre CSP-Header haben die komplette Scraper-Inventarliste geleaked.** Das ist deren geheime Sauce, frei zugänglich:

```
connect-src 'self' ... api.eventfrog.net eventfrog.net
  uploads.mapservices.eu resc.deskline.net media.tourdata.at
  www.oeticket.com server.arcgisonline.com
  widget.getyourguide.com api.getyourguide.com
  images.dc.prod.cloud.atriumsports.com
```

### Bestätigte Quellen (per AGB + Event-Attribution):

| Quelle | Was | Nutzen für dich |
|---|---|---|
| **boudicca.events** | **Open-Source Event-Aggregator aus JKU Linz (GPL-3.0)** | **GOLD** — kannst du selbst anzapfen, legal, attribution-pflicht |
| **Eventim / oeticket** | Ticketing-Events (Affiliate `J36`) | du bist morgen im Call dazu |
| **Basketball Austria** | Liga-Events (lizenziert) | nice-to-have |
| **Volkshochschule Salzburg** | Kursdaten | nice-to-have |
| **Eventfrog** (api.eventfrog.net) | Community/Free Events CH+AT | **wert anzuschauen** |
| **Feratel Deskline** (resc.deskline.net) | Tourismus | **hast du schon** |
| **TourData.at** (media.tourdata.at) | Austria-Tourismus-API | **hast du schon** |
| **GetYourGuide** (widget.getyourguide.com) | Tours/Aktivitäten Affiliate | **gute Affiliate-Option für dich** |
| **MapServices.eu / Kupfticket (OÖ Kulturvereine)** | Regionale Feeds | nice-to-have |
| **Stadt Wien OGD** (CC BY 4.0) | Wien-Events | **hast du schon** |
| **Österreich Werbung / opendataportal.at** | Tourismus-Daten | frei |
| **Wikimedia Commons / Unsplash** | Bilder | frei |

### 🎯 Actionable:
- **boudicca.events** ist der echte Hack. Open Source, GPL-3.0, komplette Event-Aggregation bereits erledigt. Du fügst eine Quelle dazu und bekommst massiv Volumen. → [github.com/boudicca-events](https://github.com/boudicca-events)
- **Eventfrog** hat free API, CH/AT Community-Events. Nicht in deinen 141 Scrapern.

---

## 3. VOLUMEN — 76.644 Events, aber...

| Bundesland | Erlebnisse | Events |
|---|---|---|
| Wien | 344 | 7.285 |
| Niederösterreich | 1.599 | 19.547 |
| **Oberösterreich** | **1.943** | **21.349** ← stärkste Region (boudicca JKU-Linz) |
| Steiermark | 1.074 | 6.988 |
| **Burgenland** | **664** | **2.188** ← **schwächste Region** |
| Kärnten | 833 | 2.821 |
| Salzburg | 1.129 | 7.773 |
| Tirol | 1.300 | 5.618 |
| Vorarlberg | 550 | 3.019 |
| **GESAMT** | **9.436** | **76.644** |

**Kritische Erkenntnis:** Burgenland ist ihre schwächste Region. Das ist dein Heimspiel. Du kannst mit deinen 141 Scrapern + Burgenland-Fokus dort qualitativ besser sein.

**Sequential DB-IDs in URLs:** Ihre Event-IDs laufen bei ~5.648.702. Bei nur 76k live Events heißt das: ~5,5 Millionen Event-Zeilen wurden über Lifetime gelöscht. Sehr hohe Churn-Rate.

---

## 4. GELDVERDIENEN — Die Monetarisierung

**Bestätigte Revenue-Ströme:**

### 4.1 oeticket Affiliate (passiv, primär)
- Jeder oeticket-Link: `?affiliate=J36`
- **Der Affiliate-Code J36 ist öffentlich und auf jeder Seite gleich**
- ⚠️ **ECG-Compliance-Risk:** Kein Affiliate-Disclosure im Text sichtbar (§ 6 ECG Graubereich bei Ticket-Buy-Links)

### 4.2 Impact.com Affiliate Network (erweitert)
- Meta-Tag im `<head>`: `<meta name='impact-site-verification' value='25269a59-96d7-4298-90ba-1d0faed72d13'>`
- Impact ist das weltweit größte Affiliate-Network-SaaS
- Signal: sie sind aufgesetzt für weitere Affiliate-Deals (Hotels, Reisen, Retail)

### 4.3 "Hervorhebungen" (paid placement)
- Laut AGB § 3a: Events/Erlebnisse können gegen Entgelt zeitlich befristet hervorgehoben werden
- Scope: bezirks-, bundesländer- oder seitenweit
- **Keine Preisliste öffentlich** — per Email via `info@wasmachma.at`
- Zahlung: Stripe (Stripe Payments Europe Ltd., Dublin)

### 4.4 Android App
- Google Play: `at.wasmachma.app` (letztes Update 18.01.2026)
- "Contains ads" → wahrscheinlich AdMob

### Was sie NICHT haben:
- Kein Abo-Modell
- Kein Premium-Tier
- Keine Banner-Werbung
- Keine Sponsored Posts
- Kein Newsletter-Sponsoring

---

## 5. SEO — Warum sie bei Google performen

### 5.1 Die Zahlen
- **~99.290 URLs indexiert** in einem chunked sitemap-Index mit 9 Sub-Sitemaps
- **2.114 Gemeinden** als programmatic landing pages (`/gemeinde/<PLZ>-<slug>`)
- **1.638 Theme-Kombinationen** (z.B. `/events/bundesland/burgenland/festivals`)

### 5.2 URL-Struktur (nachahmen!)
```
/event/4020-linz/spaetsommerfest-2026-5647419
/event/1150-rudolfsheim-fuenfhaus/beat-it-5647424
/gemeinde/9913-abfaltersbach/events
/bezirk/wien-13/spazieren
/events/bundesland/burgenland/festivals
/events/land/oesterreich/weihnachtsmaerkte
/veranstaltungsort/salzburger-landestheater
```
**Key:** PLZ + city-slug + event-slug + numerische ID → ranks für alle Long-Tail City+Event-Kombos.

### 5.3 Google-Ranking-Realität (aus WebSearch-Check)
| Query | Position |
|---|---|
| `wasmachma` (Brand) | **#1** |
| `was mach ma` | #4 |
| `events wien heute` | **NICHT in Top 10** |
| `festivals oesterreich 2026` | **NICHT in Top 10** |
| `konzerte graz` | **NICHT in Top 10** |
| `was tun in wien` | **NICHT in Top 10** |

**Erkenntnis:** Sie ranken NICHT für Head-Terms. Sie gewinnen über die ~500.000+ Long-Tail Queries aus ihren 99.290 URLs. Das ist reine programmatic SEO, keine echte Autorität.

### 5.4 On-Page SEO — SCHWÄCHE
- **Kein einziges `<h1>`** auf Event-Pages (nutzen `<h2 class="metaline">`)
- **Kein BreadcrumbList-Schema**
- **Kein hreflang** (nur DE, keine EN-Version)
- **Kein rel=prev/next**
- Homepage hat nur 1.443 chars sichtbaren Text
- Event-JSON-LD fehlt `offers` (Ticket-Preis), `performer`, `organizer`, `aggregateRating`

**Dein Stack hat bereits JSON-LD Event Schema + proper sitemap chunking. Du bist hier strukturell vorne.**

### 5.5 Backlinks — ESSENTIALLY ZERO
- Keine Erwähnung bei derStandard, Krone, Heute, Falter, Kleine Zeitung
- Kein /presse, keine Press-Releases
- Rankings basieren PUR auf programmatic topical authority, nicht auf Link-Equity
- **Kleines Link-Building bei dir kann Competitive-Queries schließen**

---

## 6. robots.txt — Strategisch interessant

```
User-agent: * → Disallow: /login/, /cronjobs/, /classes/, /pages_admin/

# KI-Trainingscrawler GEBLOCKT:
GPTBot, ClaudeBot, anthropic-ai, CCBot, Bytespider, FacebookBot, Amazonbot
→ Disallow: /

# Google & Bing → Allow: /
```

**Aggressives Blocking aller AI-Crawler.** Sie wollen nicht, dass ChatGPT/Claude ihre Daten trainieren → User müssen trotzdem auf die Seite kommen.

**Für dich relevant:** Du könntest das Gleiche machen, um deinen SEO-Content zu schützen. Oder bewusst erlauben um AI-Citations (Perplexity, ChatGPT) abzugreifen. Strategische Entscheidung.

---

## 7. FEATURES — Was sie NICHT haben (deine Chance)

| Feature | wasmachma | lasstreffen | Moat-Wert |
|---|---|---|---|
| User Accounts / Auth | ❌ | ✅ | HOCH |
| Social Features (DM, Friends, Groups, Feed) | ❌ | ✅ | SEHR HOCH |
| Artist Follow + Alerts | ❌ | ✅ | SEHR HOCH |
| Spotify Integration | ❌ | ✅ | HOCH |
| Push Notifications (VAPID) | ❌ | ✅ | HOCH |
| Email + SMS Notifications | ❌ | ✅ | HOCH |
| Festival Lineup Matching | ❌ | ✅ | SEHR HOCH |
| iOS App | ❌ | (noch nicht) | GLEICHSTAND |
| Android App | ✅ | ❌ | **DEFIZIT** |
| Newsletter | ❌ | ❌ | GLEICHSTAND |
| Blog / Editorial | ❌ | ✅ (52 Posts) | HOCH |
| Real Social Presence (IG/TikTok) | ❌ | ❌ | GLEICHSTAND |
| JSON-LD Event Schema | ⚠️ thin | ✅ richtig | HOCH |
| BreadcrumbList Schema | ❌ | ? | prüfen |
| hreflang DE/EN | ❌ | ❌ | GLEICHSTAND |
| Map (interaktiv) | ⚠️ Leaflet/OSM | ✅ Mapbox GL | HOCH |
| Reviews / Ratings | ⚠️ 10-Star blind | ❌ | PATT |
| "Ohne Registrierung" | ✅ explicit | ❌ | sein Feature, nicht deins |

---

## 8. Tooling-Stack (aus Datenschutz-Seite geleakt)

- **Analytics:** Google Analytics 4 — ID `G-2QQZKT2M4J` (öffentlich)
- **Affiliate-Verifikation:** Impact.com — ID `25269a59-96d7-4298-90ba-1d0faed72d13`
- **Payments:** Stripe (EU-Entity Dublin)
- **Maps:** OpenStreetMap (keine Mapbox-Kosten)
- **Hosting:** Apache shared/VPS (kein Edge CDN)
- **NICHT verwendet:** Facebook Pixel, Hotjar, Matomo, Plausible, Mixpanel, Sentry, Intercom

**Null Kosten-Overhead.** Sie betreiben das komplett low-budget.

---

## 9. SOCIAL / CONTENT — Ihre größte Schwäche

- **Null Social Accounts** (kein IG, FB, TikTok, YouTube, LinkedIn, X unter @wasmachma)
- **Kein Newsletter**
- **Kein Blog / Magazin**
- **Keine Gen-Z-Signale** (keine Reels, keine Stories, keine QR-Codes, keine Creator-Partnerships)
- Tonality: flaches Du-form, utilitaristisch wie Gelbe Seiten

**Founder** hat persönlich Instagram `@kollermedia_at` (314 Follower) — keine Verbindung zu WasMachMa. Persönlicher Blog kollermedia.at mit Poesie + Reise-Content.

**Dein Angriffsvektor:** Jede halbwegs ernsthafte IG/TikTok-Präsenz leapfroggt sie sofort bei der jungen Zielgruppe.

---

## 10. AGB-Besonderheiten

**§ 4a (Anti-Scraping-Klausel):**
> "Automatisierte Abfrage, systematisches Auslesen (Scraping), Crawlen oder maschinelle Erfassung ist ohne ausdrückliche schriftliche Genehmigung untersagt. Insbesondere Einspeisung in KI-Trainingsdatensätze."

**Für dich:** NICHT wasmachma.at scrapen. Ihre Quellen direkt anzapfen (boudicca.events, Eventfrog etc.) ist legitim und nicht von dieser Klausel betroffen.

---

## 11. STRATEGISCHE EMPFEHLUNGEN

### Sofort-Maßnahmen (diese Woche):
1. **boudicca.events integrieren** — Open Source, sofort +tausende Events, legal, attribution-pflichtig
2. **Eventim-Deal morgen durchziehen** — JSON-Feed + Affiliate (J36-äquivalent bei dir)
3. **Eventfrog API anschauen** — free Community-Events AT+CH
4. **GetYourGuide Affiliate** anmelden — Tours/Aktivitäten monetization

### Kurzfristig (nächste 4 Wochen):
5. **Programmatic `/gemeinde/<PLZ>-<slug>/events` Seiten** bauen — 2.093 AT-Gemeinden von GeoNames
6. **URL-Struktur prüfen:** `/event/{PLZ}-{city}/{slug}-{id}` für City+Event-Long-Tail-Keywords
7. **BreadcrumbList-Schema** auf allen Pages — gratis SEO-Win gegen wasmachma
8. **Impact.com registrieren** — zentraler Affiliate-Hub
9. **Instagram-Account starten** — Event-Previews, Stories, Reels. Sie sind blue ocean.

### Mittelfristig (3 Monate):
10. **Android-App** (PWA + Wrapper reicht) — schließt einen Lücke
11. **Hreflang DE/EN** — Touristen-Queries abgreifen
12. **Editorial/Blog ausbauen** — du hast schon 52 Posts, Kategorien vertiefen
13. **Veranstalter-Dashboard** (B2B) — sie haben nur Email-Onboarding, Selfservice-Portal ist dein Differenziator

### Nicht wichtig / bewusst ignorieren:
- ❌ Deren "ohne Registrierung"-Positionierung nachbauen (widerspricht deinem Social-Moat)
- ❌ Auf Head-Terms ranken wollen ("events wien heute") — das Rennen ist gegen wien.gv.at, falter.at, meinbezirk.at nicht gewinnbar
- ❌ 99k URL-Inventar matchen — Volume allein ist kein Moat

---

## 12. Quick-Reference

**Founder:** Jürgen Koller B.A. (Hons.)
**Adresse:** Blumengasse 12, 7221 Marz, Burgenland
**Kontakt:** info@wasmachma.at
**Gegründet:** 2025
**WKO-FirmaID (im Impressum):** 795cb54d-8546-4d63-a655-5f17c4f0b173
**Google Analytics ID:** G-2QQZKT2M4J
**Impact.com Site-ID:** 25269a59-96d7-4298-90ba-1d0faed72d13
**oeticket Affiliate Code:** J36
**Android App:** at.wasmachma.app
**Persönliche Website:** kollermedia.at (Multimedia Producer, selbstständig seit 2004)

---

*Letzte Aktualisierung: 2026-04-23. Quellen: wasmachma.at (Homepage, Impressum, AGB, Sitemap, robots.txt, event/venue pages), kollermedia.at, Google Play, WKO, WebSearch.*
