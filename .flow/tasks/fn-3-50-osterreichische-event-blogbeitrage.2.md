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

- Content fields: `intro` (1-2 paragraphs), `historyTitle` + `history` (1-2 paragraphs), `whatToExpectTitle` + `whatToExpect` (1-2 paragraphs) + `whatToExpectList` (3-6 bullet strings) — all in German, covering history, atmosphere, programme, highlights
- `keyFacts`: real dates (typical year), venue, admission info, website
- `lineup`: 3–6 representative `LineupAct` objects (optional for non-music events, use speakers/films/performers); each has `name`, optional `role?`, `day?`, `time?`, `stage?`
- `gallery`: 3 Unsplash images with verified `photo-XXXXXXXXXX` CDN IDs; alt text in German
- `practicalInfo`: array of 3–4 `{ icon: string; label: string; text: string }` objects (e.g. icon emoji, label like "Anreise", text with details)
<!-- Updated by plan-sync: fn-3-50...1 used structured content fields (intro/history/whatToExpect) not a single `description`, and practicalInfo is {icon,label,text}[] not paragraphs -->
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
- [ ] Each post: intro + history + whatToExpect content filled, keyFacts complete, gallery 3 images, practicalInfo >=3 items
- [ ] All seoTitle <=60 chars, seoDescription <=160 chars, keywords 8-12 items
- [ ] All jsonLdEvent objects have name, startDate, endDate, location.addressCountry=AT, image, description
- [ ] All Unsplash URLs use photo-XXXXXXXXXX CDN format (verified, no 404)
- [ ] All 10 posts added to ALL_POSTS barrel in index.ts
- [ ] TypeScript compiles without errors for all new files
## Done summary
Created 10 Wien event blog posts (wien-christkindlmarkt, wiener-silvesterpfad, wiener-opernball, wiener-neujahrskonzert, wiener-festwochen, vienna-city-marathon, wiener-regenbogenparade, kaiser-wiesn, wiener-genussfestival, viennale) with full content, SEO metadata, Schema.org JSON-LD with addressCountry=AT and image, and all posts added to the ALL_POSTS barrel in index.ts.
## Evidence
- Commits: 21a7aceedff5574dda76b1976f7affd986fb46d9, 9845f3e, 72fd5f6
- Tests: npx tsc --noEmit
- PRs: