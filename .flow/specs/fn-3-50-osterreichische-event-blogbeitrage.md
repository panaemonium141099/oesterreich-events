# 50 Oesterreichische Event-Blogbeitraege: Content, SEO & UI

## Goal & Context

Extend the existing festival blog (currently 3 posts in src/content/blog/festivals.ts) with 50 new, long-form Austrian event blog posts. Each post covers one major event (festival, market, parade, concert, sports event, etc.) from across Austria. All posts use the same TypeScript interfaces (FestivalPost, LineupAct, FestivalKeyFacts, GalleryImage) established in the existing code, but include richer text content.

The work also includes a data architecture refactor (split large TS file into barrel), UI integration (blog section on landing page, index page category filter, related posts), and SEO completeness (seoTitle, seoDescription, keywords, jsonLdEvent for all 50 posts plus sitemap update).

## Architecture & Data Models

### File Split Strategy (T1)

src/content/blog/types.ts - interfaces only
src/content/blog/posts/ - one file per post
src/content/blog/index.ts - barrel: export const ALL_POSTS: FestivalPost[]

lineup fields (role, time, stage) become optional. thumbnailImage also optional.

### Image Strategy

All images via Unsplash CDN (images.unsplash.com/photo-XXXXXXXXXX?w=1600&q=80 for hero). Image IDs must be verified real CDN photo- IDs (not page slugs).

### SEO / JSON-LD

Each post: seoTitle (<=60 chars), seoDescription (<=160 chars), keywords (8-12), jsonLdEvent Schema.org Event type.

## Event Coverage

### Wien (T2 - 10 posts)
1. Wiener Christkindlmarkt, 2. Silvesterpfad, 3. Opernball, 4. Neujahrskonzert, 5. Festwochen, 6. Vienna Marathon, 7. Regenbogenparade, 8. Kaiser Wiesn, 9. Genussfestival, 10. Viennale

### Salzburg & Tirol (T3 - 10 posts)
11. Salzburger Festspiele, 12. Salzburger Christkindlmarkt, 13. Jazz & The City, 14. Salzburger Dult, 15. Hahnenkamm Kitzbühel, 16. Innsbruck Festwochen Alte Musik, 17. Innsbruck Christkindlmarkt, 18. Tiroler Volksschauspiele, 19. SnowBombing Mayrhofen, 20. Forum Alpbach

### OÖ & Vorarlberg (T4 - 10 posts)
21. Linz Pflasterspektakel, 22. Linzer Klangwolke, 23. Linzer Christkindlmarkt, 24. Ars Electronica, 25. Steyr Stadtfest, 26. Bregenz Festspiele, 27. Bregenzer Frühling, 28. Montafoner Sommertage, 29. Feldkirch Festival, 30. Lustenauer Martinimarkt

### Steiermark & Kärnten (T5 - 10 posts)
31. Styriarte Graz, 32. Grazer Aufsteirern, 33. Grazer Christkindlmarkt, 34. Klagenfurter Stadtfest, 35. Ironman Austria, 36. Villacher Fasching, 37. Wörthersee Beachvolleyball, 38. Carinthian Summer Ossiach, 39. Murau Stadtfest, 40. Wörthersee Regatta

### NÖ, Burgenland & Bundesweit (T6 - 10 posts)
41. Donauinselfest, 42. Grafenegg Festival, 43. Lehár Festival Bad Ischl, 44. Esterhazy Konzerte, 45. Pannonia Fields, 46. Seefestspiele Mörbisch, 47. Wiesen Fest, 48. Lichterfest Melk, 49. Retz Weinlesefest, 50. Linz Marathon

## Key Patterns

- Follow src/content/blog/festivals.ts for data shape
- Blog detail: src/app/blog/[slug]/page.tsx - generateStaticParams + dynamicParams=false; params is a Promise (must await)
- Landing blog section: src/components/Landing/FestivalBlogSection.tsx
- JSON-LD injected via script type=application/ld+json in detail page

## Acceptance Criteria

- [ ] All interfaces extracted to src/content/blog/types.ts; barrel index.ts exports ALL_POSTS
- [ ] 3 existing posts migrated to src/content/blog/posts/ without regressions
- [ ] 50 new FestivalPost objects with full content (description >=3 paragraphs, keyFacts, gallery 3 images, practicalInfo >=2 paragraphs, seoTitle <=60, seoDescription <=160, keywords 8-12, jsonLdEvent)
- [ ] All Unsplash URLs use verified photo-XXXXXXXXXX CDN IDs, no 404s
- [ ] FestivalBlogSection on landing page shows posts from full pool
- [ ] Blog index /blog has category filter tabs
- [ ] Each blog detail page has correct title, meta description, JSON-LD Event schema
- [ ] src/app/sitemap.ts covers all 53 blog slugs
- [ ] npm run build passes with no TypeScript errors
- [ ] No broken images

## Boundaries

- No new Supabase tables or schema changes
- No scraper changes
- No auth/profile changes
- Existing 3 posts keep their slugs and all content

## Decision Context

- T1 (architecture) must complete first
- T2-T6 (content batches) can run after T1 and are independent of each other
- T7 (UI) depends on T1
- T8 (docs/sitemap) runs last
