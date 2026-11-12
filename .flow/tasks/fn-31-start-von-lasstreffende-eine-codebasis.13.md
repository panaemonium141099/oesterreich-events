# fn-31-start-von-lasstreffende-eine-codebasis.13 Quellen und Rechtsseiten je Site (Wortlaut vom Nutzer)

## Description
Quellen- und Rechtsseiten je Site. Technik und Platzhalter baut dieser Task; den Wortlaut liefert oder gibt der Nutzer frei (Entscheidungen 2, 3, 9). Keine rechtliche Bewertung durch Claude.

**Size:** M
**Files:** `src/app/[locale]/quellen/page.tsx`, `src/app/[locale]/impressum/page.tsx`, `src/app/[locale]/datenschutz/page.tsx`, `src/app/[locale]/agb/page.tsx`, `src/app/[locale]/bildnachweis/page.tsx`, `src/lib/site/legal.ts` (neu), `src/components/Legal/Footer.tsx`

## Approach
- `/quellen`: Quellenliste je Site. DE nennt GeoNames (CC BY 4.0), BKG VG250 (dl-de/by-2-0), Destatis, Eventfrog, OpenStreetMap (nur wo auf .de verwendet), Eventim und die Gemeindekalender. Die Namensnennungen wörtlich aus den Lizenztexten bzw. aus den Bedingungen der Quelle, mit Link; Vorlage für die Freigabe im PR.
- Rechtsseiten: Inhalt je Site aus `legal.ts`. Solange für DE kein freigegebener Text vorliegt, bricht der DE-Build mit klarer Meldung ab (kein Platzhalter-Impressum im Netz).
- Footer und `DevNotice`: Kontakt aus der Site.

## Key context
- AT-Texte bleiben Wort für Wort gleich.
- Jede Event-Detailseite zeigt weiter `source_name` und `source_url` (Pflicht).
## Acceptance
- [ ] AT: die vier Seiten unverändert (Textvergleich)
- [ ] DE-`/quellen` nennt jede auf .de verwendete Quelle mit Lizenz und Link; Wortlaut vom Nutzer freigegeben
- [ ] DE-Build ohne freigegebene Rechtstexte schlägt fehl; mit Texten rendert er sie
- [ ] Freigabe des Nutzers für Impressum, Datenschutz, Nutzungsbedingungen liegt vor (im Task vermerkt)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
