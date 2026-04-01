# fn-3-50-osterreichische-event-blogbeitrage.4 T4: Content Batch OOe & Vorarlberg (10 posts)

## Description
Create 10 long-form blog post TypeScript files for major OÖ & Vorarlberg events.

### Events to cover

21. `linz-pflasterspektakel` — Linz Pflasterspektakel (Juli)
22. `linzer-klangwolke` — Linzer Klangwolke (September)
23. `linzer-christkindlmarkt` — Linzer Christkindlmarkt (Dezember)
24. `ars-electronica-festival` — Ars Electronica Festival Linz (September)
25. `steyr-stadtfest` — Steyr Stadtfest (Sommer)
26. `bregenz-festspiele` — Bregenzer Festspiele (Juli-August)
27. `bregenzer-fruehling` — Bregenzer Frühling (März-April)
28. `montafoner-sommertage` — Montafoner Sommertage Kammermusik (Juli-August)
29. `feldkirch-festival` — Feldkirch Festival (Mai)
30. `lustenauer-martinimarkt` — Lustenauer Martinimarkt (November)

### Per post requirements (same as T2)

- Content fields: `intro` (1-2 paragraphs), `historyTitle` + `history` (1-2 paragraphs), `whatToExpectTitle` + `whatToExpect` (1-2 paragraphs) + `whatToExpectList` (3-6 bullet strings) — all in German
- `keyFacts`: real dates, venue, admission, website
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
- `seoTitle`: <=60 chars, `seoDescription`: <=160 chars, `keywords`: 8-12
- `jsonLdEvent`: Schema.org Event with `location` (string), `addressCountry: 'AT'` (sibling field), `image`, `url`, `description`

### After writing posts

Append all 10 imports to `src/content/blog/index.ts` ALL_POSTS array.
## Acceptance
- [ ] 10 files created under src/content/blog/posts/ for OOe & Vorarlberg events
- [ ] Each post: intro + history + whatToExpect content filled, keyFacts complete, gallery 3 images, practicalInfo >=3 items
- [ ] All seoTitle <=60, seoDescription <=160, keywords 8-12
- [ ] All jsonLdEvent have name, startDate, endDate, location (string), addressCountry='AT', url, image, description
<!-- Updated by plan-sync: fn-3-50...2 — jsonLdEvent.location is a plain string, addressCountry is a sibling field -->
- [ ] All Unsplash URLs verified photo-XXXXXXXXXX CDN format
- [ ] All 10 posts appended to ALL_POSTS in index.ts
- [ ] TypeScript compiles without errors
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
