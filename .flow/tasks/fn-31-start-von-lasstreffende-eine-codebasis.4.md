# fn-31-start-von-lasstreffende-eine-codebasis.4 Texte und übrige Domain-Stellen je Site (Nachrichten-Überlagerung)

## Description
Übrige Domain-Literale und die Österreich-Texte kommen aus der Site. Texte je Land über eine Überlagerung der Nachrichten-Datei.

**Size:** M (bei mehr als rund 40 Dateien in zwei PRs teilen: Seiten und Komponenten, dann Mails und Skripte)
**Files:** `src/i18n/request.ts`, `messages/de.json`, `messages/de.DE.json` (neu), Seiten und Komponenten mit Domain-Literal (rund 25), `src/emails/*`, `src/lib/email.ts`, `src/lib/newsletter.ts`, Cron-Routen, `src/__tests__/lib/domain-literal-guard.test.ts`

## Approach
- `src/i18n/request.ts`: tiefe Zusammenführung von `de.json` mit der Überlagerung der Site (next-intl bringt keinen Helfer mit, eine flache Spreizung reicht nicht). Für AT gibt es keine Überlagerung, das Ergebnis ist Byte für Byte wie heute.
- Die 81 „Österreich“-Stellen in `messages/de.json` und die 31 Komponenten und Seiten: Texte, die auf .de sichtbar werden (Feature-Matrix), bekommen einen DE-Wortlaut in der Überlagerung oder einen Site-Platzhalter. Texte abgeschalteter Säulen bleiben unberührt.
- Domain-Literale in Seiten, Komponenten, Mails: `getSite().url` bzw. `brand`. Rechtstexte und Blog-Inhalte bleiben Ausnahmen.
- Ausnahmeliste des Domain-Wächters auf die begründeten Reste kürzen.
- Wächter: jeder Schlüssel der Überlagerung existiert in `de.json`.

## Key context
- Keine Gedankenstriche in sichtbaren Texten.
- User-Agent-Strings der Scraper nennen die Domain als Kontakt, sie bleiben (Ausnahme mit Begründung).
## Acceptance
- [ ] AT: gerenderte Nachrichten unverändert (Test vergleicht geladenes Objekt mit `de.json`)
- [ ] DE: keine sichtbare Seite der Feature-Matrix zeigt „Österreich“, „österreichisch“ oder lasstreffen.at (Test über die gerenderten Kernseiten)
- [ ] Ausnahmeliste des Domain-Wächters enthält nur noch Rechtstexte, Blog-Inhalte, Tests, User-Agents
- [ ] Überlagerungs-Wächter grün
## Done summary
Nachrichten-Ueberlagerung je Seite (messages/de.DE.json, 23 Texte, Marke automatisch), DE_LOCALE statt festem de-AT in 97 Dateien, Domain/Marke/Kontakt im Kern aus getSite(). Domain-Waechter mit begruendeten Ausnahmen statt Liste. Offen: Hub-Einleitungen je Bundesland (AT-Schluessel, fuer DE in fn-31.11), Rechts- und Ueber-uns-Texte (fn-31.13), Mails und Crons bleiben AT.
## Evidence
- Commits: 6f08a186
- Tests: npx vitest run (4636 gruen, lokal nur die drei Windows-Faelle rot), SITE_COUNTRY=DE: 41 gruen
- PRs: