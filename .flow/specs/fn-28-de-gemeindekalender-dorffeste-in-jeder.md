# DE-Gemeindekalender: Dorffeste in jeder Gemeinde (Recherche je Bundesland)

## Goal & Context
Für lasstreffen.de soll jede deutsche Gemeinde mit ihren lokalen Veranstaltungen
abgedeckt sein: Dorffeste, Feuerwehrfeste, Kirchweih/Kerwe/Kirmes, Schützenfeste,
Maifeste, Weinfeste, Weihnachtsmärkte, Vereinsfeste. Das ist neben dem großen
Bestand aus Tourismus- und Ticketing-Quellen der größte Hebel (wie in Österreich).

In Österreich tragen das wenige Generics, die viele Gemeinden auf einmal lesen:
`Gem2GoScraper` (eine Plattform, viele Gemeinden), `GemeindeRegistryScraper`
(Liste mit Kalender-URL je Gemeinde, gemeinsame Parser-Strategien) und
`GenericGemeindeScraper` (src/lib/scrapers/). Gesucht ist das deutsche
Gegenstück: Plattformen, Hersteller, Verlage und Datenbanken, die mit EINER
Integration viele Gemeinden liefern, bevorzugt über Feed/API/Export.

Ausgangslage (belegt, docs/research/deutschland-event-quellen-2026-10.md):
destination.one `open-data` liefert ohne Key 34.984 Events in 12 Monaten,
DZT-Knowledge-Graph mit Key, Eventim/Eventfrog/Reservix für Ticketing.
Offen ist, wie viel davon Dorffeste sind.

Gemeinden je Land (Destatis GV-ISys, Verwaltungsgliederung Stichtag 30.09.2026,
https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/Verwaltungsgliederung/Verwalt3QAktuell.xlsx?__blob=publicationFile):
gesamt 10.749. RP 2.300, BY 2.056, SH 1.104, BW 1.101, NI 941, MV 724,
TH 601, HE 421, SN 418, BB 413, NW 396, ST 218, SL 52, HB 2, BE 1, HH 1.
Gemeindeverbände (Ämter, Verbandsgemeinden, Samtgemeinden, VG): RP 129,
BY 311, SH 83, BW 270, NI 114, MV 76, TH 79, SN 70, BB 52, ST 18.

## Architecture & Data Models
Reine Recherche, kein Code. Ein Ticket je Bundesland plus ein Querschnitts-
Ticket für bundesweite Anbieter und eine Synthese. Jedes Ticket schreibt eine
Datei unter `docs/research/de-gemeinden/` (Dateiname im Ticket) und öffnet
einen eigenen PR auf master.

Methode je Land (Pflicht):
1. **Stichprobe:** mindestens 30 Gemeinden mit unter 10.000 Einwohnern aus dem
   Gemeindeverzeichnis-Auszug (Destatis, Stichtag 30.09.2026,
   https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile)
   reproduzierbar ziehen (Zufallszahl-Seed und Ziehungsregel dokumentieren).
   Für jede Gemeinde festhalten, wo ihre Veranstaltungen veröffentlicht sind:
   eigene Website (CMS/Hersteller erkennen: Generator-Meta, Footer, Pfade),
   Amt/Verbandsgemeinde/Samtgemeinde, Amtsblatt/Mitteilungsblatt (Verlag),
   Kreis- oder Regionalkalender, Tourismusdatenbank, Gemeinde-App, nirgends.
2. **Generics finden:** Jede Plattform, die in der Stichprobe mehrfach
   auftaucht oder laut Betreiber viele Gemeinden bedient, als Kandidat
   bewerten: Betreiber, Zahl der Gemeinden (nur belegt, sonst Anteil in der
   Stichprobe), Zugriffsweg (API, JSON, XML, iCal, RSS, Export; sonst
   einheitliche HTML-Struktur), echte Feldnamen aus einer Probe, Lizenz/AGB/
   robots.txt, Beispiel-URLs für drei Gemeinden.
3. **Dorffest-Test:** In jeder Quelle nach den typischen Festarten suchen
   (Feuerwehrfest, Kirchweih/Kerwe/Kirmes, Schützenfest, Maifest, Weinfest,
   Weihnachtsmarkt) und je Quelle mindestens ein belegtes Beispiel verlinken.
4. **Abgleich destination.one:** Für die Stichprobengemeinden zählen, ob
   `https://meta.et4.de/rest.ashx/search/?experience=open-data&type=Event&template=ET2014A.json&limit=1`
   mit Ortsfilter Treffer hat (Syntax: https://help.destination.one/portal/de/kb/articles/meta-service-search).
   So wird messbar, wie viel die Tourismusdaten bei kleinen Gemeinden schon abdecken.
5. **Ergebnis:** priorisierte Integrationsliste fürs Land (Gemeinden je
   Integration, Datenqualität, Rechtslage), Lücken, nächster Schritt je Quelle.

## API Contracts
Ergebnisdatei je Land mit diesen Abschnitten: Kurzfazit; Stichprobe (Tabelle
Gemeinde, AGS, Einwohner, Fundort, CMS/Plattform, Link, destination.one-Treffer);
Generics (je Kandidat die Punkte aus Methode 2); Dorffest-Test; Abdeckung
geschätzt NUR als Stichprobenanteil mit Formel; priorisierte Liste mit
nächstem Schritt; Liste aller gestellten Anfragen.

## Edge Cases & Constraints
- Fakten nur mit Quelle (Link oder echte Antwort), nie schätzen; Unbekanntes
  als „nicht belegt“ markieren.
- Keine Konten, keine Formulare, keine Mails. Nur wenige lesende GET-Anfragen
  je Host, robots.txt beachten, kein Crawling ganzer Websites.
- Keine Scraper bauen. Wo nur HTML hilft, Struktur und Einheitlichkeit
  dokumentieren, damit eine spätere Implementierung entscheiden kann.
- Texte ohne Gedankenstriche.
- Andere Tickets laufen parallel: vor dem Start `docs/research/de-gemeinden/`
  auf master lesen (fetch), bekannte Anbieter nicht doppelt recherchieren,
  sondern verlinken und nur die Landessicht ergänzen.

## Acceptance Criteria
- [ ] 16 Länderdateien plus Querschnitt und Synthese unter docs/research/de-gemeinden/
- [ ] Je Land Stichprobe ≥ 30 Gemeinden (Stadtstaaten: Bezirke/Ortsteile) mit Fundort
- [ ] Je Generic: Zugriffsweg, echte Felder, Lizenz/AGB, Zahl der Gemeinden belegt oder als Stichprobenanteil
- [ ] Synthese: Abdeckungsmatrix Land × Integration und Reihenfolge für die Umsetzung

## Boundaries
Keine Implementierung, keine Stammdaten-Datei für DE (eigenes Epic danach),
keine Ticketing-Quellen (siehe bestehender Bericht), kein Ticketmaster
(gestrichen 2026-10-27: Terms verbieten Erlöse, AdSense nicht ausgenommen).

## Decision Context
Eine Datei je Land, damit die Tickets parallel in eigenen Sessions laufen
können. Die Stichprobe zuerst, weil sie zeigt, wo kleine Gemeinden wirklich
veröffentlichen, statt Anbieterlisten zu raten.
