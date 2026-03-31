# fn-3-50-osterreichische-event-blogbeitrage.1 T1: Data Architecture Refactor (types + barrel + migrate 3 posts)

## Description
Refactor the blog content system from a single monolithic file into a maintainable barrel structure, and migrate the 3 existing posts.

### What to do

1. Create `src/content/blog/types.ts` — extract all interfaces (`FestivalPost`, `LineupAct`, `FestivalKeyFacts`, `GalleryImage`) from `src/content/blog/festivals.ts`. Make `lineup` field on `LineupAct` optional (`role?`, `time?`, `stage?`). Make `thumbnailImage` optional on `FestivalPost`.

2. Create `src/content/blog/posts/nova-rock.ts`, `src/content/blog/posts/frequency.ts`, `src/content/blog/posts/fm4-frequency.ts` (or whatever the 3 existing slugs are) — each exports a single `const post: FestivalPost = { ... }` with the full existing data moved verbatim.

3. Create `src/content/blog/index.ts` — barrel that imports all post files and exports:
   - `export const ALL_POSTS: FestivalPost[]` (array of all posts, sorted by publishedAt desc)
   - `export function getPostBySlug(slug: string): FestivalPost | undefined`
   - `export function getPostsByCategory(category: string): FestivalPost[]`

4. Update `src/app/blog/[slug]/page.tsx` — import from `@/content/blog` (the barrel) instead of directly from `festivals.ts`. Verify `params` is awaited (Next.js 16 App Router).

5. Update `src/components/Landing/FestivalBlogSection.tsx` — import from `@/content/blog` barrel.

6. Delete or deprecate `src/content/blog/festivals.ts` (or keep as re-export shim if needed for backwards compat).

7. Add `next.config.ts` cache header for `/blog/*` routes: `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`.

### Key files to read first
- `src/content/blog/festivals.ts` — existing data + interfaces
- `src/app/blog/[slug]/page.tsx` — detail page (generateStaticParams, dynamicParams, params await)
- `src/components/Landing/FestivalBlogSection.tsx` — current import pattern
## Acceptance
- [ ] `src/content/blog/types.ts` exists with all 4 interfaces; lineup fields and thumbnailImage are optional
- [ ] 3 existing posts exist as individual files under `src/content/blog/posts/`
- [ ] `src/content/blog/index.ts` exports `ALL_POSTS`, `getPostBySlug`, `getPostsByCategory`
- [ ] Blog detail page and FestivalBlogSection import from barrel, not from festivals.ts
- [ ] `npm run build` passes with no TypeScript errors
- [ ] Navigating to all 3 existing blog URLs still works (no 404, content unchanged)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
