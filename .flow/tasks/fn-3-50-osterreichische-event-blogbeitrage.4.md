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

- `description`: 4–6 paragraphs, German
- `keyFacts`: real dates, venue, admission, website
- `lineup`: 3–6 acts/highlights where applicable
- `gallery`: 3 Unsplash images with verified photo-XXXXXXXXXX CDN IDs
- `practicalInfo`: 3–4 paragraphs
- `seoTitle`: <=60 chars, `seoDescription`: <=160 chars, `keywords`: 8-12
- `jsonLdEvent`: Schema.org Event with addressCountry: AT

### After writing posts

Append all 10 imports to `src/content/blog/index.ts` ALL_POSTS array.
## Acceptance
- [ ] 10 files created under src/content/blog/posts/ for OOe & Vorarlberg events
- [ ] Each post: description >=4 paragraphs, keyFacts complete, gallery 3 images, practicalInfo >=3 paragraphs
- [ ] All seoTitle <=60, seoDescription <=160, keywords 8-12
- [ ] All jsonLdEvent have required fields with addressCountry: AT
- [ ] All Unsplash URLs verified photo-XXXXXXXXXX CDN format
- [ ] All 10 posts appended to ALL_POSTS in index.ts
- [ ] TypeScript compiles without errors
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
