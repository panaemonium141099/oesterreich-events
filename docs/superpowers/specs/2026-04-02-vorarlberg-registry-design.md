# Vorarlberg Gemeinde-Registry

## Ziel

`data/gemeinden-registry/vorarlberg.json` mit 96 Eintraegen, jeder individuell recherchiert und fetch-verifiziert. Kein neuer Scraper-Code noetig — der bestehende GemeindeRegistryScraper laedt automatisch alle JSON-Dateien aus dem Registry-Verzeichnis.

## Verbesserter Workflow (Learnings aus Burgenland)

Jeder Research-Agent muss fuer jede Gemeinde:

1. Google: "[Name] Veranstaltungen Vorarlberg"
2. Gemeinde-Website besuchen, Event-Seite finden
3. URL sofort mit fetch() testen (HTTP Status pruefen)
4. Wenn HTTP 200: Dates zaehlen (DD.MM.YYYY Regex)
5. Wenn Fehler ODER 0 Dates: sofort Alternative suchen
   - citiesapps.com/cities/[slug]/events checken
   - citiesapps.com/pages/[slug]/events/upcoming checken
   - Andere Pfade auf der Website probieren
   - Google nochmal mit anderem Suchterm
6. Erst wenn funktionierende URL gefunden (200 + dates > 0) → Eintrag erstellen
7. Wenn gar nichts geht → status: "no-calendar" mit Begruendung

Agents geben NUR fertige, verifizierte Eintraege zurueck.

## Registry-Schema

Identisch zu Burgenland:

```json
{
  "name": "Dornbirn",
  "website": "https://www.dornbirn.at",
  "eventUrl": "https://www.dornbirn.at/veranstaltungen",
  "cms": "typo3",
  "strategy": "generic-dates",
  "plz": "6850",
  "bezirk": "Dornbirn",
  "bundesland": "Vorarlberg",
  "lat": 47.4125,
  "lng": 9.7417,
  "status": "active",
  "notes": "TYPO3 site, events with dates and images.",
  "verifiedAt": "2026-04-02"
}
```

## Parallelisierung

96 Gemeinden aufgeteilt auf 4 Bezirke:
- Bludenz (~29 Gemeinden)
- Bregenz (~32 Gemeinden)
- Dornbirn (~5 Gemeinden)
- Feldkirch (~30 Gemeinden)

4 Agents parallel, einer pro Bezirk.

## Akzeptanzkriterien

- [ ] 96 Eintraege in vorarlberg.json
- [ ] Jede URL fetch-verifiziert (HTTP 200 oder explizit no-calendar)
- [ ] Scrape liefert Events ohne Supabase-Sync-Fehler
- [ ] Keine ungültigen Datumsformate
