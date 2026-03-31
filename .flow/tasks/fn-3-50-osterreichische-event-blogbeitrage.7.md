# fn-3-50-osterreichische-event-blogbeitrage.7 T7: UI Integration (landing section, blog index filter, related posts, nav)

## Description
Integrate the full blog post pool into the UI. This task runs after T1 (barrel exists).

### Changes required

1. **`src/components/Landing/FestivalBlogSection.tsx`**
   - Import `ALL_POSTS` from `@/content/blog`
   - Show the top 6 posts (by publishedAt desc, or a `featured` flag if added)
   - Add a "Alle Beiträge" link to `/blog`

2. **Blog index page: `src/app/blog/page.tsx`** (create if not exists)
   - Server component listing all posts from `ALL_POSTS`
   - Category filter tabs: "Alle", "Musik", "Kultur", "Märkte", "Sport", "Brauchtum", "Klassik" — use URL search param `?category=X` for SSR filtering
   - Post grid: card per post (thumbnail, title, category badge, short description excerpt, "Weiterlesen" link)
   - SEO: `generateMetadata` returning title "Österreich Events Blog | Event-Guides & Tipps" + meta description
   - Canonical URL

3. **Blog detail page: `src/app/blog/[slug]/page.tsx`**
   - Add "Ähnliche Beiträge" section at bottom: 3 posts from same category (excluding current)
   - Verify `generateStaticParams` returns all 53 slugs (pull from `ALL_POSTS.map(p => p.slug)`)
   - Verify JSON-LD Event schema is injected for all posts

4. **Navigation**
   - Add "Blog" link to the top navigation or header if one exists
   - Or add to footer links if no top nav

### Key files to read first
- `src/components/Landing/FestivalBlogSection.tsx`
- `src/app/blog/[slug]/page.tsx`
- `src/content/blog/index.ts` (created in T1)
- Any header/nav component that renders sitewide links
## Acceptance
- [ ] FestivalBlogSection shows top 6 posts from ALL_POSTS pool, with "Alle Beitraege" link
- [ ] /blog page exists with working category filter tabs and post grid
- [ ] /blog has generateMetadata with proper title and description
- [ ] Blog detail page shows "Aehnliche Beitraege" section (3 same-category posts)
- [ ] generateStaticParams covers all 53 slugs
- [ ] JSON-LD Event schema present on all detail pages
- [ ] A "Blog" entry point exists in site navigation
- [ ] npm run build passes with no TypeScript errors
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
