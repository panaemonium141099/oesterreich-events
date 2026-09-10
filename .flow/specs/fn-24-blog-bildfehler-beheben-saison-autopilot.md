# Blog: Bildfehler beheben + Saison-Autopilot

## Goal & Context
Zwei Baustellen am Blog-Cron:

**(1) Falsche Hero-Bilder — belegt, nicht vermutet.** Alle 25 vom Autowriter
erzeugten Event-Posts tragen ein Wikimedia-Commons-Foto, das nichts mit dem
Event zu tun hat. Beispiel `science-busters-for-kids-2026`: Hero ist das Cover
von „YANK The Army Weekly", 9. Maerz 1945 (US-Army-Magazin) — Wikimedia hat auf
das Wort „Busters" gematcht.

Ursache (gemessen): Eventim liefert im PFT-Feed nur `esPictureBig` im Format
`.../teaser/222x222/...` — nachgemessen exakt 222x222 px, 18 KB. Der Autowriter
verwirft in `downloadImage()` alles unter `MIN_HERO_WIDTH = 900` und faellt dann
auf `wikimediaHero(c.title)` zurueck: eine ungefilterte Volltextsuche auf
Commons ueber den Event-Titel. Groessere Varianten existieren nicht (444/600/900/
1200/originals → alle HTTP 404), die oeticket-Eventseite antwortet Bots mit 403.

Der User besitzt fuer Eventim-Events das Recht am echten Bild. Ein 222er
Originalbild ist richtig, ein 1800er Fremdfoto ist falsch — die Groesse darf
nicht laenger ueber die Bildwahl entscheiden.

**(2) Saisonale Inhalte fehlen.** Redaktionsplan Herbst/Winter 2026/27
(`lasstreffen-herbst-winter-2026.md`) listet fuenf Themen mit hohem, planbarem
Suchvolumen, die in den naechsten 12 Wochen ihren Peak haben. Der bestehende
`saison-guide.yml` laeuft monatlich am Ersten und trifft die harten
„Live bis"-Termine (12.09., 15.09., 25.09., 01.10., 08.10., 20.10.) nicht.

## Architecture & Data Models
- `FestivalPost.heroLayout?: 'cover' | 'poster'` — neu. `cover` = bisheriges
  full-bleed `object-cover`; `poster` = quadratisches Originalartwork scharf
  und contained vor einem unscharf-gezoomten Backdrop derselben Datei.
- `resolveHero()` nimmt IMMER das Event-eigene `image_url`, wenn eines da ist.
  Kein Wikimedia-Fallback mehr fuer Event-Posts.
- `wikimediaHero()` bleibt fuer kuratierte Queries (Stay-Guides, Saison-Hubs),
  bekommt aber ein Relevanz-Gate: mindestens ein Query-Token muss im
  Commons-Dateititel vorkommen.
- Saison-Kalender wird deadline-getrieben (`liveBy`) statt `publishMonth`.

## Acceptance Criteria
- [ ] Kein Autowriter-Event-Post traegt mehr ein Wikimedia-Foto
- [ ] Die 25 bestehenden Posts sind nachtraeglich auf das echte Eventim-Bild umgestellt
- [ ] Poster-Layout rendert 222px-Artwork ohne sichtbare Unschaerfe
- [ ] Saison-Cron trifft die `liveBy`-Termine des Redaktionsplans
- [ ] Erste Saison-Posts (P0/P1) sind recherchiert und live

## Boundaries
Kein KI-Enrichment von Event-Daten (MASTERPLAN §6). Keine OSM-/Viator-Themen.
