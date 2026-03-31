# fn-3-50-osterreichische-event-blogbeitrage.8 T8: Sitemap, CLAUDE.md & CHANGELOG update

## Description
Final housekeeping: sitemap, CLAUDE.md update, CHANGELOG entry.

### Changes required

1. **`src/app/sitemap.ts`**
   - Add blog post URLs: for each post in `ALL_POSTS`, add `{ url: 'https://oestereich-events.at/blog/${slug}', lastModified: post.updatedAt ?? post.publishedAt, changeFrequency: 'monthly', priority: 0.7 }`
   - Add `/blog` index page entry with priority 0.8
   - Verify the blog entry count: should be 53 posts + 1 index = 54 blog URLs

2. **`CLAUDE.md`**
   - Add `src/content/blog/` section to Wichtige Pfade explaining the barrel structure
   - Add blog-related routes (`/blog`, `/blog/[slug]`) to the paths list
   - Note the FestivalPost interface location

3. **`CHANGELOG.md`**
   - Add a new entry for this feature: date, what was added (50 new blog posts, architecture refactor, UI integration, SEO), list of new routes

### Key files to read first
- `src/app/sitemap.ts` — current structure
- `CLAUDE.md` — current content
- `CHANGELOG.md` — current format
- `src/content/blog/index.ts` — to verify ALL_POSTS count
## Acceptance
- [ ] sitemap.ts includes all 53 blog post URLs + /blog index URL
- [ ] CLAUDE.md documents the blog content structure and routes
- [ ] CHANGELOG.md has a new entry for this feature
- [ ] npm run build still passes after sitemap changes
- [ ] No TypeScript errors introduced
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
