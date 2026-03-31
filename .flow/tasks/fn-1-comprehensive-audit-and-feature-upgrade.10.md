# fn-1-comprehensive-audit-and-feature-upgrade.10 Performance Bundle Optimization and SSR

## Description
Optimize bundle size and implement SSR/ISR where possible. Remove dead Leaflet dependencies (if not done in task 4), analyze bundle with `@next/bundle-analyzer`, implement ISR for static pages, optimize images with next/image.

**Size:** M
**Files:** package.json, next.config.ts, src/app/page.tsx, src/app/impressum/page.tsx, src/app/datenschutz/page.tsx, src/app/agb/page.tsx, src/components/Events/EventCard.tsx

## Approach
- Install `@next/bundle-analyzer` and run analysis to identify largest chunks
- Remove any remaining Leaflet/react-leaflet imports and dependencies (verify from task 4)
- Remove `better-sqlite3` from production bundle if only used for CLI scraping — move to devDependencies or make import conditional
- Add ISR to legal pages (impressum, datenschutz, agb) — `revalidate: 86400` (daily)
- Convert event images from `<img>` to `next/image` with width/height/placeholder — use `remotePatterns` already in next.config.ts
- Add dynamic imports for heavy client components (Mapbox) — already partially done, verify
- Implement `loading.tsx` files for route segments that benefit from streaming
- Tree-shake unused exports from large utility files

## Key context
- `serverExternalPackages` in next.config.ts already includes `better-sqlite3` — it loads server-side
- 57 remote patterns already configured in next.config.ts for image domains
- Legal pages (impressum, datenschutz, agb) are untracked new files — good candidates for static generation
- EventMap is already dynamically imported with `ssr: false` in map/page.tsx
## Acceptance
- [ ] Bundle analysis run, largest chunks identified
- [ ] No Leaflet code in production bundle (verify with analyzer)
- [ ] Legal pages use ISR with 24h revalidation
- [ ] Event images use next/image component
- [ ] `loading.tsx` added for key route segments
- [ ] Bundle size reduced (document before/after)
- [ ] `npm run build` succeeds with no warnings about large chunks
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
