# fn-3-50-osterreichische-event-blogbeitrage.3 T3: Content Batch Salzburg & Tirol (10 posts)

## Description
Create 10 long-form blog post TypeScript files for major Salzburg & Tirol events.

### Events to cover

11. `salzburger-festspiele` — Salzburger Festspiele (Juli-August)
12. `salzburger-christkindlmarkt` — Salzburger Christkindlmarkt (Dezember)
13. `salzburg-jazz-and-the-city` — Salzburg Jazz & The City (Oktober)
14. `salzburger-dult` — Salzburger Dult (Frühling/Herbst)
15. `hahnenkamm-rennen-kitzbuehel` — Hahnenkamm-Rennen Kitzbühel (Januar)
16. `innsbruck-festwochen-alte-musik` — Innsbruck Festwochen der Alten Musik (Juli-August)
17. `innsbruck-christkindlmarkt` — Innsbruck Christkindlmarkt (Dezember)
18. `tiroler-volksschauspiele-telfs` — Tiroler Volksschauspiele Telfs (Sommer, alle 4 Jahre)
19. `snowbombing-mayrhofen` — SnowBombing Festival Mayrhofen (April)
20. `europaeisches-forum-alpbach` — Europäisches Forum Alpbach (August)

### Per post requirements (same as T2)

- Content fields: `intro` (1-2 paragraphs), `historyTitle` + `history` (1-2 paragraphs), `whatToExpectTitle` + `whatToExpect` (1-2 paragraphs) + `whatToExpectList` (3-6 bullet strings) — all in German
- `keyFacts`: real dates (typical year), venue, admission, website
- `lineup`: 3–6 `LineupAct` objects; each has `name`, optional `role?`, `day?`, `time?`, `stage?`
- `gallery`: 3 Unsplash images with verified photo-XXXXXXXXXX CDN IDs
- `practicalInfo`: array of 3–4 `{ icon: string; label: string; text: string }` objects
<!-- Updated by plan-sync: fn-3-50...1 used structured content fields not `description`, practicalInfo is {icon,label,text}[] -->
- `subtitle`: short tagline for the event
- `categoryColor`: Tailwind class string (e.g. `'bg-red-700 text-white'`)
- `ctaText`: call-to-action button label (e.g. `'Jetzt entdecken'`)
- `ctaLink`: CTA URL (typically the event website)
- `practicalInfoTitle`: heading string (e.g. `'Praktische Infos für Besucher'`)
- `thumbnailImage`: same Unsplash photo as heroImage but with `w=800` instead of `w=1600`
<!-- Updated by plan-sync: fn-3-50...2 — FestivalPost requires subtitle, categoryColor, ctaText, ctaLink, practicalInfoTitle; thumbnailImage is optional but recommended -->
- `seoTitle`: ≤60 chars, `seoDescription`: ≤160 chars, `keywords`: 8–12
- `jsonLdEvent`: Schema.org Event with `location` (string), `addressCountry: 'AT'` (sibling field), `image`, `url`, `description`

### After writing posts

Append all 10 imports to `src/content/blog/index.ts` ALL_POSTS array.
## Acceptance
- [ ] 10 files created under src/content/blog/posts/ for Salzburg & Tirol events
- [ ] Each post: intro + history + whatToExpect content filled, keyFacts complete, gallery 3 images, practicalInfo >=3 items
- [ ] All seoTitle <=60, seoDescription <=160, keywords 8-12
- [ ] All jsonLdEvent have name, startDate, endDate, location (string), addressCountry='AT', url, image, description
<!-- Updated by plan-sync: fn-3-50...2 — jsonLdEvent.location is a plain string, addressCountry is a sibling field not nested inside location -->
- [ ] All Unsplash URLs verified photo-XXXXXXXXXX CDN format
- [ ] All 10 posts appended to ALL_POSTS in index.ts
- [ ] TypeScript compiles without errors
## Done summary
Created 10 long-form blog post TypeScript files for major Salzburg and Tirol events (Salzburger Festspiele, Christkindlmarkt, Jazz & The City, Dult, Hahnenkamm-Rennen, Innsbrucker Festwochen der Alten Musik, Innsbrucker Christkindlmarkt, Tiroler Volksschauspiele Telfs, Snowbombing Mayrhofen, Europäisches Forum Alpbach), all appended to ALL_POSTS in index.ts; all seoTitles <=60 chars, seoDescriptions <=160 chars, and TypeScript compiles without errors.
## Evidence
- Commits: 33de01ad074d0f4054b72cf49c40fa921439f0f4, ac7a3fd6a9f7e3b5a6e9a9dd4cdaa23e1a86ae99
- Tests: npm test -- --run (127/127 passed), npx tsc --noEmit (0 errors)
- PRs: