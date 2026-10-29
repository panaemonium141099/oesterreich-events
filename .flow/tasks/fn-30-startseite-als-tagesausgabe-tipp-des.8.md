# fn-30-startseite-als-tagesausgabe-tipp-des.8 Shelf-Spur ohne Überhang auf /entdecken, Hubs, Thema, Studenten

## Description
## Ziel
Die Regal-Spur endet an der rechten Inhaltskante, auf allen Seiten, die `Shelf` nutzen.
Größe S.

## Kontext
- `src/components/Discover/v4/shelf-ui.tsx:68`: Spur mit `-mx-4 px-4 md:-mx-14 md:px-14` und
  `[scroll-padding-left:16px] md:[scroll-padding-left:56px]`. Entfernen; `snap-x` bleibt,
  `py-1` ergänzen (Fokusringe), Spur als `role="region"` mit `aria-label` = Regaltitel.
- Da der Überhang auf dem Handy als Hinweis diente, dass die Spur scrollt: rechter Verlauf
  (`mask-image` oder Pseudo-Element) als Hinweis; Desktop behält die Pfeile.
- Konsumenten prüfen: `V4EntdeckenShelves.tsx:26`, `src/components/Hub/HubShelves.tsx:22`,
  `HubEventGrid.tsx:3`, `src/app/[locale]/thema/[slug]/page.tsx:44`,
  `src/app/[locale]/studenten/page.tsx:7`, `src/components/Landing/LoadMoreEvents.tsx:6`.
- Mockup-Referenz: `docs/design/landing-redesign/base.css` (`.track`).

**Files:** `src/components/Discover/v4/shelf-ui.tsx`, ggf. Snapshot-Tests der Konsumenten.
## Acceptance
- [ ] Rechte Kante der Spur = rechte Kante des Inhalts auf `/entdecken`, `/wien`,
      `/thema/<slug>`, `/studenten` (Messung per `getBoundingClientRect`, Screenshots im PR).
- [ ] Erste Karte sitzt bündig links, Snap funktioniert, Fokusring der Karten ist nicht
      abgeschnitten.
- [ ] Handy: sichtbarer Hinweis, dass die Spur scrollt (Verlauf), kein horizontales Scrollen
      der Seite.
- [ ] `npm test` grün.
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
