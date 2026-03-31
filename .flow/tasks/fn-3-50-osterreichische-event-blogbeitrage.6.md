# fn-3-50-osterreichische-event-blogbeitrage.6 T6: Content Batch NOe, Burgenland & Bundesweit (10 posts)

## Description
Create 10 long-form blog post TypeScript files for major NÖ, Burgenland & bundesweite events.

### Events to cover

41. `donauinselfest` — Donauinselfest Wien/NÖ (Juni) — Europe's largest free music festival
42. `grafenegg-festival` — Grafenegg Festival NÖ (August-September)
43. `lehar-festival-bad-ischl` — Lehár Festival Bad Ischl / Salzkammergut (Juli-August)
44. `esterhazy-konzerte` — Schloss Esterhazy Konzerte Eisenstadt (Sommer)
45. `pannonia-fields` — Pannonia Fields Electronic Festival Burgenland (August)
46. `seefestspiele-moerbisch` — Seefestspiele Mörbisch (Juli-August)
47. `wiesen-fest` — Wiesen Fest Burgenland (August) — Punk/Alternative
48. `lichterfest-melk` — Lichterfest Melk / Wachau (Sommer)
49. `retz-weinlesefest` — Retz Weinlesefest (Oktober)
50. `linz-marathon` — Linz Marathon (April)

### Per post requirements (same as T2)

- `description`: 4–6 paragraphs, German
- `keyFacts`: real dates, venue, admission, website
- `lineup`: 3–6 acts/highlights where applicable
- `gallery`: 3 Unsplash images with verified photo-XXXXXXXXXX CDN IDs
- `practicalInfo`: 3–4 paragraphs
- `seoTitle`: <=60 chars, `seoDescription`: <=160 chars, `keywords`: 8-12
- `jsonLdEvent`: Schema.org Event with addressCountry: AT

### After writing posts

Append all 10 imports to `src/content/blog/index.ts` ALL_POSTS array. After this task, ALL_POSTS should contain all 53 posts (3 existing + 50 new).
## Acceptance
- [ ] 10 files created under src/content/blog/posts/ for NOe/Burgenland/bundesweit events
- [ ] Each post: description >=4 paragraphs, keyFacts complete, gallery 3 images, practicalInfo >=3 paragraphs
- [ ] All seoTitle <=60, seoDescription <=160, keywords 8-12
- [ ] All jsonLdEvent have required fields with addressCountry: AT
- [ ] All Unsplash URLs verified photo-XXXXXXXXXX CDN format
- [ ] All 10 posts appended to ALL_POSTS in index.ts (total should be 53)
- [ ] TypeScript compiles without errors
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
