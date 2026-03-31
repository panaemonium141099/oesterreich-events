# fn-3-50-osterreichische-event-blogbeitrage.2 T2: Content Batch Wien (10 posts)

## Description
Create 10 long-form blog post TypeScript files for major Wien events, each as `src/content/blog/posts/<slug>.ts` exporting a `FestivalPost`.

### Events to cover

1. `wien-christkindlmarkt` — Wiener Christkindlmarkt am Rathausplatz (Dezember)
2. `wiener-silvesterpfad` — Wiener Silvesterpfad (31. Dezember)
3. `wiener-opernball` — Wiener Opernball (Fasching)
4. `wiener-neujahrskonzert` — Neujahrskonzert der Wiener Philharmoniker
5. `wiener-festwochen` — Wiener Festwochen (Mai-Juni)
6. `vienna-city-marathon` — Vienna City Marathon (April)
7. `wiener-regenbogenparade` — Wiener Regenbogenparade / Pride (Juni)
8. `kaiser-wiesn` — Kaiser Wiesn / Wiener Wiesn-Fest (Oktober)
9. `wiener-genussfestival` — Wiener Genussfestival (September/Oktober)
10. `viennale` — Viennale – Wiener Internationales Filmfestival (Oktober)

### Per post requirements

- `description`: 4–6 paragraphs, German, covering history, atmosphere, programme, highlights
- `keyFacts`: real dates (typical year), venue, admission info, website
- `lineup`: 3–6 representative acts/highlights (optional for non-music events, use speakers/films/performers)
- `gallery`: 3 Unsplash images with verified `photo-XXXXXXXXXX` CDN IDs; alt text in German
- `practicalInfo`: 3–4 paragraphs on getting there, accommodation tips, what to bring, tickets
- `seoTitle`: ≤60 chars, includes event name + "Wien" + year context
- `seoDescription`: ≤160 chars, compelling summary with keywords
- `keywords`: 8–12 German/English keywords
- `jsonLdEvent`: Schema.org Event with real location (PostalAddress addressCountry: AT), startDate, endDate

### Image verification

For each Unsplash image used, search Unsplash for the topic, get real `photo-` CDN IDs (not page slugs). The CDN format is `https://images.unsplash.com/photo-XXXXXXXXXX?w=1600&q=80`.

### After writing posts

Add each post import to `src/content/blog/index.ts` barrel (append to `ALL_POSTS` array).
## Acceptance
- [ ] 10 files created under `src/content/blog/posts/` for Wien events
- [ ] Each post: description >=4 paragraphs, keyFacts complete, gallery 3 images, practicalInfo >=3 paragraphs
- [ ] All seoTitle <=60 chars, seoDescription <=160 chars, keywords 8-12 items
- [ ] All jsonLdEvent objects have name, startDate, endDate, location.addressCountry=AT, image, description
- [ ] All Unsplash URLs use photo-XXXXXXXXXX CDN format (verified, no 404)
- [ ] All 10 posts added to ALL_POSTS barrel in index.ts
- [ ] TypeScript compiles without errors for all new files
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
