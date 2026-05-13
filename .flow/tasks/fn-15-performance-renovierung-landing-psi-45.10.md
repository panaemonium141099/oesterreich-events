# fn-15-performance-renovierung-landing-psi-45.10 Service Worker mit Workbox (Repeat-LCP <500ms)

## Description

Repeat-Visitors zahlen aktuell erneut 1-3 MB Image-Bytes. Workbox Service Worker
mit stale-while-revalidate für `/_next/image/*` (30d TTL), Cache-First für
`/static/*`, plus Offline-Fallback-Page. Update-Strategy: **Hybrid-Banner**
("Update verfügbar — neu laden") statt skipWaiting.

**Size:** M (~1-2 Tage)

## Files

- `public/sw.js` — Workbox-Setup oder `src/sw/index.ts` (mit Vite/SWR build)
- `src/app/layout.tsx` — Service-Worker-Registration in <head>
- `src/components/UpdateBanner.tsx` — Toast/Banner für Update-Verfügbar
- `src/lib/sw-register.ts` — Registration + Update-Flow-Logic

## Acceptance

- [ ] Service Worker wird auf Production registriert (verifiziert via
      DevTools → Application → Service Workers)
- [ ] `/_next/image/*` Requests werden mit stale-while-revalidate gecached
      (verifiziert: 2. Page-Load zeigt "from ServiceWorker" in Network-Tab)
- [ ] Cache-TTL ist 30 Tage (Workbox-Config: `maxAgeSeconds: 60 * 60 * 24 * 30`)
- [ ] `/static/*` Cache-First mit längerer TTL
- [ ] Update-Banner erscheint wenn neuer SW available ist (NICHT skipWaiting)
- [ ] User-Click auf Banner triggert `skipWaiting()` + `window.location.reload()`
- [ ] Offline-Fallback-Page wird ausgeliefert wenn Network down ist
- [ ] PSI Repeat-Visit-LCP <= 500ms (manueller WebPageTest mit "repeat view")

## Evidence-Notes

- DevTools-Screenshots: Service Worker registered, Cache populated
- Network-Tab vor/nach (2. Page-Load mit "ServiceWorker"-Source)
- Manual Test: Offline-Mode → Fallback-Page erscheint
- Update-Flow-Demo: deploy + Banner-erscheint + Klick-reload-Cycle
- Rollback: Service-Worker-Unregister-Script auf Production deployen
  + Vercel-instant für Code-Changes

## Done summary
Merged Workbox 7.3.0 (SELF-HOSTED under /public/workbox/ — 6 files, ~21KB total, no CDN dependency) into /public/sw.js for stale-while-revalidate caching of /_next/image/* (30-day TTL) and cache-first for /_next/static, /fonts, /category-images; the existing Web-Push handlers are preserved verbatim. All 6 Workbox modules are eagerly importScripted inside a try/catch + namespace-completeness probe so a corrupt module gracefully downgrades to push-only mode without crashing the SW. <ServiceWorkerProvider /> mounts in the root layout, registers /sw.js on production, and surfaces an "Update verfügbar — neu laden" hybrid banner via <UpdateBanner /> that postMessages {type:'SKIP_WAITING'} to the waiting worker so the user keeps control of the upgrade. CSP does NOT need storage.googleapis.com (codex round-3 fix — earlier CDN-version was reverted), /sw.js is served Cache-Control: max-age=0 + must-revalidate, and a styled /offline.html falls in when network is down. Codex impl-review SHIP after 5 rounds.
## Evidence
- Commits: d8bcfdbdcee2c67111e02fe5ddd26252ab8eee79
- Tests: npm run build (prebuild + next build + postbuild CSP verifier OK across 94 HTML files / 95 routes), npx tsc --noEmit (4 pre-existing baseline errors in test files, no new errors from fn-15.10), npx vitest run src/__tests__/lib/service-worker.test.ts (7 passed, 0 failed — Workbox 7 import, SWR + 30d TTL, /_next/static CacheFirst, hybrid-banner SKIP_WAITING, /offline.html fallback, push handlers preserved), npx vitest run src/__tests__/components/ (27 passed, 0 failed — no regression in component tests), npx vitest run src/__tests__/lib/ (525 passed / 62 failed — same pre-existing baseline as fn-15.9, none of the failures touch SW code)
- PRs: