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

## Evidence

- DevTools-Screenshots: Service Worker registered, Cache populated
- Network-Tab vor/nach (2. Page-Load mit "ServiceWorker"-Source)
- Manual Test: Offline-Mode → Fallback-Page erscheint
- Update-Flow-Demo: deploy + Banner-erscheint + Klick-reload-Cycle
- Rollback: Service-Worker-Unregister-Script auf Production deployen
  + Vercel-instant für Code-Changes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
