# fn-2-deploy-ready-sprint-scoring-landing.5 SEO Metadata, OG Tags & JSON-LD

## Description
Update `layout.tsx` with full OG/Twitter/metadataBase metadata, add `robots.ts`, and add WebSite + Organization JSON-LD to the homepage.

**Size:** M
**Files:** `src/app/layout.tsx`, `src/app/robots.ts` (new), `src/app/page.tsx`

## Approach

**`layout.tsx` metadata:** Replace the minimal metadata with full `Metadata` object. Key fields: `metadataBase: new URL('https://lasstreffen.at')`, `title.default` + `title.template: '%s | LassTreffen.at'`, `description`, `openGraph` (type website, locale de_AT, url, siteName LassTreffen.at, title, description), `twitter` (card summary_large_image), `robots: { index: true, follow: true }`. Note: no `openGraph.images` for now — acceptable without a dedicated OG image asset.

**`robots.ts`:** `src/app/robots.ts` — export default function returning `MetadataRoute.Robots`. Rules: allow `/`, disallow `['/api/', '/admin/', '/auth/', '/profile/']`. Sitemap: `https://lasstreffen.at/sitemap.xml`.

**JSON-LD on homepage:** In `src/app/page.tsx` (Server Component), add two `<script type="application/ld+json">` tags: WebSite schema (name, url, description, potentialAction SearchAction pointing to `/map?search={query}`) and Organization schema (name LassTreffen.at, url, description). Use `dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\u003c') }}` for XSS safety. Do NOT use `next/script` — plain `<script>` tag in Server Component HTML is the official Next.js approach.

## Key Context
- `src/app/layout.tsx` is 29 lines — the metadata export is at lines 7-10, replace entirely
- `metadataBase` in root layout propagates to all child pages automatically — child pages only need to provide relative URLs in their OG images
- The visible brand text on the page still says "Osterreich Events" (in `page.tsx`) — do NOT change it in this task (brand copy change is out of scope)
- `robots.ts` caches by default in Next.js 16 — no explicit ISR config needed
## Acceptance
- [ ] `curl http://localhost:3000 | grep "og:"` shows og:title, og:description, og:type, og:url
- [ ] `curl http://localhost:3000 | grep "twitter:"` shows twitter:card
- [ ] `GET /robots.txt` returns rules disallowing `/api/`, `/admin/`, `/auth/`, `/profile/`
- [ ] `/robots.txt` includes `Sitemap: https://lasstreffen.at/sitemap.xml`
- [ ] Homepage HTML contains `<script type="application/ld+json">` with WebSite schema
- [ ] Homepage HTML contains Organization schema JSON-LD
- [ ] JSON-LD passes validation at https://validator.schema.org (check manually after build)
- [ ] `npm run build` passes
## Done summary
Updated layout.tsx with full OG/Twitter metadata and metadataBase, created robots.ts disallowing /api/, /admin/, /auth/, /profile/ with sitemap reference, and added WebSite + Organization JSON-LD structured data to the homepage via XSS-safe dangerouslySetInnerHTML.
## Evidence
- Commits: 5e892c7f11aed9ae4d0c5e733a2ea74509d33b03
- Tests: npx tsc --noEmit (no new errors)
- PRs: