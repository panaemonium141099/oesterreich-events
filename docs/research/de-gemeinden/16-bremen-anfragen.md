# Anfragen zu 16-bremen.md (29.10.2026)

Alle Abrufe lesend. curl mit User-Agent `Mozilla/5.0 (research; lasstreffen.at)`, Browser
(eingebautes Browserfenster) nur für bremen.de, weil curl dort an der Cloudflare-Prüfung
scheitert. Status in eckigen Klammern; 000 = keine Verbindung.

## Stammdaten und Stichprobe

| Host | Anfrage | Status | Zweck |
|---|---|---|---|
| www.statistik.bremen.de | `/robots.txt` | [leer] | robots |
| www.statistik.bremen.de | `/datenangebote/stadtteil-und-ortsteiltabellen-4529` | [200] | Liste der Ortsteiltabellen |
| www.statistik.bremen.de | `/sixcms/media.php/13/2025-09_AI1vj_Bevoelkerungsstand_pdfa.pdf` | [200] | Bevölkerungsstand (ohne Ortsteiltabelle) |
| www.statistik-bremen.de | `/robots.txt` | [404] | robots |
| www.statistik-bremen.de | `/tabellen/kleinraum/stadt_ottab/ST{111,121,123,124,125,126,127,131,132,133,134,135,136,137,138,141,142,143,144,151,152,153,199}.csv` (23 Dateien, je 1 s Pause) | [200] | Ortsteilnamen und Einwohner 31.12.2015 |
| de.wikipedia.org | API `parse` „Bremerhaven“ (Abschnitte, Abschnitt 5), „Liste der Verwaltungsebenen in Bremerhaven“ | [200] | erste Ortsteilliste Bremerhaven, ersetzt durch WFS |
| geodienste.bremen.de | `/robots.txt` | [200] | sperrt nur `spatineo` |
| geodienste.bremen.de | `/wfs_verwaltungsgrenzen?SERVICE=WFS&REQUEST=GetCapabilities` | [200] | Layer, Lizenz CC BY 4.0 |
| geodienste.bremen.de | `GetFeature` `app:Ortsteile_Bremen`, `app:Ortsteile_Bremerhaven`, `SRSNAME=EPSG:4326` | [200] [200] | 112 Ortsteile mit Grenzen, Grundgesamtheit |

## bremen.de (G1)

| Host | Anfrage | Status | Zweck |
|---|---|---|---|
| www.bremen.de | `/robots.txt` | [200] | robots |
| www.bremen.de | `/sitemap-events.xml` | [200] | 1.309 Veranstaltungsseiten |
| www.bremen.de | `/veranstaltung/laternenlauf-in-findorff-2026` per curl | [403] | Cloudflare-Challenge |
| www.bremen.de | dieselbe Seite im Browser | [200] | JSON-LD, iCal-Link |
| www.bremen.de | `/nutzungsbedingungen-und-agb`, `/nutzungsbedingungen-und-agb/nutzungsbedingungen-veranstaltungskalender` im Browser | [200] | Nutzungsbedingungen |
| login.bremen.de | `/robots.txt` | [200] | sperrt `/ical/*` |
| login.bremen.de | `/ical/event/laternenlauf-in-findorff-2026/11018879` per curl | [403] | Challenge; danach wegen robots nicht weiter verwendet |
| www.bremen.de | `/veranstaltungen` → `/kultur/veranstaltungen` im Browser | [200] | Suchmaske, Stadtteilfilter |
| login.bremen.de | `POST /api/event-search/search`, ausgelöst über die Suchmaske: Stadtteilfilter für alle 23 Stadtteile (teils zweimal, weil die erste Runde Antworten falsch zuordnete), Gesamtsuche 29.10.2026 bis 28.10.2027, 12 Monatsfenster 29.10.2026 bis 28.10.2027 | [200] | Felder, Zählung, 928 Veranstaltungen |
| www.bremen.de | `/build/assets/*.js`, `login.bremen.de/build/assets/app-*.js` im Browser (vom Seitenaufruf geladen, einmal per `fetch` gelesen) | [200] | Suchendpunkt finden |

## destination.one (G2)

| Host | Anfrage | Status | Zweck |
|---|---|---|---|
| meta.et4.de | `/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=200&startdate=10/29/2026&enddate=10/28/2027&q=area:"Bremen"` | [200] | 189 Events |
| meta.et4.de | dieselbe mit `q=city:"Bremen"` | [200] | 17 Events |
| meta.et4.de | dieselbe mit `q=city:"Bremerhaven"` | [200] | 172 Events |

## Ortsämter (G5)

| Host | Anfrage | Status |
|---|---|---|
| www.ortsamt-burglesum.bremen.de | `/robots.txt` [leer], `/` [200], `/stadtteil/veranstaltungen-21984` [200], `/rss-feed/test-rss-1811?lang=de` [200] | |
| www.ortsamt-seehausen.bremen.de | `/robots.txt` [leer], `/` [200], `/sixcms/media.php/13/160326_Newsletter%2B03-26_OA%2BSeehausen.pdf` [200] | |
| www.ortsamtmitte, ortsamt-neustadt (→ ortsamt-woltmershausen), ortsamt-woltmershausen, ortsamt-huchting, ortsamt-strom, ortsamt-horn-lehe, ortsamt-borgfeld (→ www.ortsamt-borgfeld.de), ortsamt-oberneuland, ortsamt-osterholz, ortsamt-hemelingen, ortsamtwest, ortsamt-vegesack, ortsamt-blumenthal `.bremen.de` | `/` | [200] |
| www.ortsamt-obervieland, ortsamt-schwachhausen, ortsamt-schwachhausen-vahr, ortsamt-blockland `.bremen.de` | `/` | [000] |
| www.ortsamt-horn-lehe.bremen.de | `/aktuelles/veranstaltungen-im-stadtteil-10109` | [200] |
| www.ortsamtwest.bremen.de | `/walle/termine-2731`, `/findorff/termine-2728`, `/groepelingen/termine-20741` | [200] |
| www.ortsamt-vegesack.bremen.de | `/termine-29807` | [200] |
| www.ortsamt-borgfeld.de | `/aktuelles-news-1474` | [200] |
| www.ortsamt-osterholz.bremen.de | `/ortsamt-osterholz/newsletter-23632`, `/sixcms/media.php/13/Newsletter%20August%202026.pdf` | [200] [200] |
| www.senatskanzlei.bremen.de | `/robots.txt` | [000] |

## Stadtteil- und Dorfquellen (G3, G4, G6)

| Host | Anfrage | Status |
|---|---|---|
| bremen-nord.de | `/robots.txt` [200], `/wp-json/` [200], `/wp-json/wp/v2/ajde_events?per_page=100&orderby=modified&_fields=…` [200], `/wp-json/wp/v2/ajde_events/6994` [200], `/events/weihnachtsmarkt-lesum/` [200], `/wp-json/wp/v2/event_type?per_page=100` [200] | |
| bremen-nord.de | `/impressum/` (WebFetch) | [200] |
| www.der-bremer-norden.de | `/robots.txt` [200], `/wp-json/` [200], `/events.ics` [200], `/impressum/` (WebFetch) [200] | |
| www.walle-aktuell.de | `/robots.txt` [200], `/` (WebFetch) [200], `/veranstaltungen` [200] | |
| findorff.de | `/robots.txt` [200], `/wp-json/` [200] | |
| kultur-vor-ort.com | `/robots.txt`, `/wp-json/` | [000] |
| www.weser-kurier.de | `/robots.txt` [200], `/veranstaltungen` [404]; danach wegen KI-Sperre nicht weiter | |
| www.blockland.de | `/robots.txt` [404], `/` [200], `/aktuelles/index-termine.php` [200] | |
| www.borgfelder-forum.de | `/robots.txt` [200], `/borgfeld-laedt-ein/` [200] | |
| geestemuende.de | `/robots.txt` [200, HTML], `/` → `/start` [200], `/veranstaltungen` [200] | |
| leherheide.de | `/robots.txt` [404], `/` → `/de/startseite` [200] | |
| mbq-bremerhaven.de | `/robots.txt` [200], `/` [200], `/termine` [200] | |
| www.bremerhaven.de | `/robots.txt` [200]; wegen `Disallow: /` keine weiteren Abrufe | |
| www.feuerwehr.bremerhaven.de | `/robots.txt` | [302] |
| www.kirche-bremen.de | `/robots.txt` [200], `/` [200], eine Veranstaltungsseite [200], `/sitemap.xml` [200] | |

## Open Data

| Host | Anfrage | Status |
|---|---|---|
| www.govdata.de | `/ckan/api/3/action/package_search` mit `q` „veranstaltung OR veranstaltungen OR termine OR feste“, „veranstaltungen bremen“, „bremen veranstaltungskalender“, „bremerhaven veranstaltungen“ | [200] je, kein Bremer Datensatz |
| www.transparenz.bremen.de | `/robots.txt` [200], `/suche?q=Veranstaltungskalender&opendata=1` [404] | |

## Websuche

Suchmaschine für: Ortsteilliste und Statistik, bremen.de-Schnittstelle, Ortsamt-Termine,
Bremerhaven-Kalender (zweimal), Blockland-Erntefest, Borgfeld-Termine, Weser-Kurier-Kalender,
Bremerhaven-Stadtteilfeste, WFS-Ortsteilgrenzen, Ortsamt Obervieland und Schwachhausen/Vahr.
