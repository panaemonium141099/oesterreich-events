# v4 Redesign — Phase 1: Foundation & Navigation

**Datum:** 2026-05-14
**Branch:** `claude/keen-meninsky-ea9660`
**Status:** Design — awaiting user review
**Phasen-Kontext:** Phase 1/5 des v4-Redesigns. Folge-Phasen (Landing, Card-System, Event-Detail, Künstler/Entdecken, Plan-Wizard/Meine Pläne) bekommen je einen eigenen Spec.

---

## 1. Goal & Context

Etabliere die visuelle und navigatorische Foundation des v4-Redesigns ohne bestehende Funktionalität zu verändern. Konkret:

- Globale Top-Nav mit den 4 v4-Primäreinheiten (Entdecken · Künstler · Karte · Meine Pläne) plus Search-Affordance und Auth-Island.
- Globale Mobile-Tab-Bar (5 Items: + Profil).
- D7-Wordmark-Logo (`lass`·**`treffen`**·📍·`at`) als wiederverwendbare Komponente.
- v4-Designtokens additiv in `globals.css` für die nachfolgenden Phasen.
- Bisherige Chrome-Schicht (`LandingAuth`-Pille auf Landing, `SocialNav` in `AppShell`) wird durch die neuen Komponenten abgelöst.
- `/plans`-Route als Stub (302 → `/saved`), damit der "Meine Pläne"-Tab in Phase 1 funktional ist; die echte Plans-Page kommt in Phase 5.

Das Design folgt `mockups/v4-redesign.html` aus dem Anthropic-Design-Bundle (extrahiert nach `C:\Users\jonag\AppData\Local\Temp\design-v4\lasstreffen-at-design-system\`), insbesondere `V4TopNav`, `V4MobileTop`, `V4TabBar`, `V4Logo` aus `v4-shared.jsx`.

### Driving Brief (aus chat2 des Design-Bundles)

> *"The product must be simplified around three primary funnels: Artist Search + Follow, Ticket purchase through partner deeplinks, Event Plan Wizard. Remove Feed/Chat/Groups/Memories/Standalone Calendar from primary navigation and homepage. Do not necessarily delete them from the codebase. Treat them as hidden/deprioritized legacy social features."*

---

## 2. Out of Scope (explicit)

Diese Phase fasst **nicht** an:

- `EventCard`, `EventCardV2`, `EventListCard`, `EventPreviewCard`, `EventDetailV2`, `EventDetail`, `EventSheet` — alles unter `src/components/Events/`
- Card-States, Sand-Badges, Match-Glyphen — kommen in Phase 2
- Landing-Content: Hero, `HeroSection`, `LandingStats`, `LandingSections`, `WeeklyHighlights`, `RegionExplorer`, `PopularCategories`, `ParticleBackground`, `Onboarding`, `ScrollHint`, `gradient-mesh` — kommen in Phase 2
- `/feed`, `/groups`, `/messages`, `/friends`, `/calendar`, `/memories` — bleiben funktional, verschwinden nur aus der primären Nav
- Notifications-Backend, Realtime-Channels, Toast-System
- Mapbox-Komponenten
- Auth-Modals (kommen in Phase 4 mit Künstler-Tab)
- Plan-Wizard-Logik (Phase 5)
- Scraper, Enrichment, Geocoding, Artist-Matching — nicht berührt
- Internationalisierung — bleibt de-AT only

Das `SocialNav.tsx`-File selbst bleibt liegen (kein Mount mehr, aber kein Code-Touch — minimal-scope-Regel).

---

## 3. Architecture & Mounting

Mount-Strategie: **Global im Root-Layout**, mit kleiner Client-Insel für Auth-State.

```
src/app/layout.tsx (Root, RSC)
├── <head> ... </head>
└── <body>
    ├── <RouteTransitions />            (bestehend)
    ├── <V4TopNav />                    NEU — sticky top, hidden on <md
    ├── <div className="route-root">    (bestehend, View-Transition-Anchor)
    │     {children}
    │   </div>
    ├── <V4TabBar />                    NEU — fixed bottom, md:hidden
    ├── {modal}                         (bestehend)
    ├── <ServiceWorkerProvider />       (bestehend)
    └── <Toaster />                     (bestehend)
```

**Warum global im Root und nicht via AppShell?**
- `/`, `/entdecken`, `/map`, `/blog`, `/[bundesland]`, alle Auth-Routes sollen identische Chrome bekommen → Root ist die einzige Layer, die alle erfasst.
- `AppShell` würde nur Auth-Routes erreichen → inkonsistent.
- Die neuen Komponenten brauchen keinen `AuthProvider`-Kontext (Auth-Island self-hydratet), also kein Bundle-Penalty für anon Routen (fn-15.5-Strategie bleibt intakt).

**SSR/ISR-Verhalten:**
- `V4TopNav` und `V4TabBar` rendern statisch (kein `cookies()`, kein `headers()`, kein RSC-Fetch).
- `V4TopNavAuth` rendert SSR den anon-State ("Anmelden"-Button); auf Client-Hydrate kommt evtl. Swap zu Avatar/Bell. Brief flash akzeptabel (gleiche Pattern wie heutiger `LandingAuth`).
- ISR der Landing (`revalidate = 3600`) bleibt valide — die statisch gerenderte Anon-Chrome ist die korrekte HTML für die >95% anon Traffic + Googlebot.

---

## 4. Component Contracts

Verzeichnis: `src/components/Layout/v4/`

### 4.1 `V4Logo.tsx` (RSC)

```ts
interface V4LogoProps {
  size?: 'sm' | 'md';       // sm = 15 px, md = 17 px (default)
  light?: boolean;          // light surfaces → black ink (rare)
}
```

Pure Server-Component, inline-SVG für Pin. Kein State, kein JS.

- `lass` = font-weight 400
- `treffen` = font-weight 800
- Pin = SVG path (`#c8553d` fill, surface-color circle innen, 0.55× font-size)
- `at` = font-weight 400
- Letter-spacing: -0.05em (von Mockup übernommen)

### 4.2 `V4TopNav.tsx` (Client)

```ts
// 'use client' — braucht usePathname für Active-State
```

- Sticky `<header>` `top-0`, `z-30`, `h-16` (64 px), `border-b` mit `--v4-hairline-2`
- Innen-Container: `max-w-[1180px]`, `px-14` (56 px) auf md+, `px-4` (16 px) auf mobile
- Layout `flex items-center gap-5`:
  - `<V4Logo />`
  - `<nav>` mit 4 Pill-Links (versteckt unter md): Entdecken→`/`, Künstler→`/artists`, Karte→`/map`, Meine Pläne→`/plans`
  - `<div className="flex-1" />` (spacer)
  - ⌘K-Affordance (Pill mit Search-Icon + "Künstler, Event oder Ort suchen" + `<kbd>⌘ K</kbd>`) — versteckt unter `lg`. Phase 1: linkt einfach zu `/entdecken`. (Echtes Modal kommt später.)
  - `<V4TopNavAuth />` (kleiner Client-Island)
- Active-State: `usePathname()` matcht via `startsWith` auf konfigurierte Patterns. Z.B. Künstler-Tab aktiv auf `/artists` UND `/artists/*`. Entdecken-Tab aktiv auf `/`, `/entdecken`, `/entdecken/*`.
- Mobile (`<md`): nur Logo links, Search-Icon + Bell + Avatar rechts (`V4TopNavAuth` rendert die rechte Mobile-Variante intern).
- Visuell: `bg-[var(--v4-surface)]` Default; Tailwind-Klassen, keine Inline-Styles.

### 4.3 `V4TopNavAuth.tsx` (Client)

```ts
// 'use client'
// Self-hydrating session via createClient() — kein AuthProvider-Mount
```

- Pattern: 1:1 wie `LandingAuth.tsx` (gleicher `supabase.auth.getSession()` + `onAuthStateChange`-Setup)
- Anon-State: `<Link href="/auth/login">Anmelden</Link>` Pill (klein, secondary tone)
- Logged-in-State: Bell-Icon (mit Match-farbenem Dot top-right wenn unread > 0 — Phase 1 zeigt **immer** den Dot, weil kein NotificationsProvider gemountet ist) + Avatar-Initial-Pille
- Avatar-Initial: aus `user_metadata.first_name?.[0]` oder `email?.[0]`
- Bell linkt zu `/notifications` (bestehende Route)
- Avatar-Klick: für Phase 1 linkt einfach zu `/profile`. Dropdown-Menü kommt in einer späteren Phase.

### 4.4 `V4TabBar.tsx` (Client)

```ts
// 'use client' — usePathname für Active-State
```

- `<nav>` fixed `bottom-0 left-0 right-0 z-25`, `md:hidden`
- `pb-[26px] pt-2` (Safe-Area-Padding bottom, top-padding für Touch-Area)
- `bg-gradient-to-t from-[rgba(10,10,12,0.96)] to-[rgba(10,10,12,0.78)]` + `backdrop-blur-xl` + `border-t border-[var(--v4-hairline-2)]`
- 5 Tabs `flex justify-around items-center`:
  | Tab | Href | Icon (Lucide) | Active-Match |
  |---|---|---|---|
  | Entdecken | `/` | `Home` | `/`, `/entdecken*` |
  | Künstler | `/artists` | `Music` | `/artists*` |
  | Karte | `/map` | `MapIcon` | `/map*` |
  | Pläne | `/plans` | `Ticket` | `/plans*`, `/saved*` |
  | Profil | `/profile` *oder* `/auth/login` (anon) | `User` | `/profile*`, `/auth*` |
- Profil-Tab: Client-side hat dieselbe Self-Hydration wie `V4TopNavAuth`, oder noch einfacher: per `data-anon` attribute auf einem äußeren Wrapper das href via CSS-`:where()` togglen — vermutlich zu fancy. Stattdessen: tiny `useEffect`-basierter Check, der `authed`-State setzt und href entsprechend rendert.
- Aktiv-Icon: stroke-width 2.2, Label-Text in `--v4-ink`. Inaktiv: stroke-width 1.6, Label-Text in `--v4-ink-50`.
- Layout-Spacer im Root-Layout: KEIN globaler Spacer (würde Desktop unnötig padden). Stattdessen rendert `V4TabBar` selbst auf mobile einen `<div aria-hidden className="h-[76px] md:hidden" />` als letztes Kind seines Parents, um Content-Overlap zu vermeiden. ALTERNATIVE: globaler `pb-[76px] md:pb-0` auf `<body>` — aber das könnte CLS verursachen. Wir machen den Spacer-Trick **innerhalb** der Page-Wrapper-Komponente (siehe §6.2).

### 4.5 `src/app/plans/page.tsx` (RSC)

```ts
import { redirect } from 'next/navigation';

export default function PlansStubPage(): never {
  redirect('/saved');
}
```

5 Zeilen. Existierende `/saved`-Route übernimmt die Anzeige. In Phase 5 wird dieser Stub durch die echte Plans-Page ersetzt.

---

## 5. Token Additions

Anhängen an `src/app/globals.css` (am Ende, eigener `:root`-Block mit Kommentar-Heading):

```css
/* ─────────────────────────────────────────────────────────────
   v4 Redesign — Foundation Tokens (Phase 1)
   Additiv zu bestehenden --color-* und --planer-* Tokens.
   Verwendung: ab Phase 1 Nav, ab Phase 2 in neuen Card-Komponenten.
   ───────────────────────────────────────────────────────────── */
:root {
  --v4-ink:              #ffffff;
  --v4-ink-70:           rgba(255, 255, 255, 0.70);
  --v4-ink-50:           rgba(255, 255, 255, 0.50);
  --v4-ink-30:           rgba(255, 255, 255, 0.30);

  --v4-hairline-1:       rgba(255, 255, 255, 0.04);
  --v4-hairline-2:       rgba(255, 255, 255, 0.06);
  --v4-hairline-3:       rgba(255, 255, 255, 0.10);
  --v4-hairline-4:       rgba(255, 255, 255, 0.15);

  --v4-surface:          #0a0a0c;
  --v4-surface-elevated: #141416;
  --v4-surface-inset:    #050506;

  /* Semantic Akzente für Card-States (Phase 2) — schon definiert
     damit Phase 1 Nav-Bell-Dot bereits --v4-match nutzen kann. */
  --v4-ticket:           #d4b896;
  --v4-match:            #f5b942;
  --v4-go:               #7bb794;
  --v4-alert:            #c67079;
}
```

Keine bestehenden Tokens werden umbenannt, gelöscht oder semantisch neu gefasst. Keine Komponente außerhalb der Phase-1-Komponenten konsumiert die `--v4-`-Tokens.

---

## 6. Files Added / Modified

### 6.1 Added

- `src/components/Layout/v4/V4Logo.tsx` — ~50 LOC
- `src/components/Layout/v4/V4TopNav.tsx` — ~120 LOC
- `src/components/Layout/v4/V4TopNavAuth.tsx` — ~100 LOC (adaptierter LandingAuth-Code)
- `src/components/Layout/v4/V4TabBar.tsx` — ~80 LOC
- `src/components/Layout/v4/index.ts` — Re-exports
- `src/app/plans/page.tsx` — 5 LOC stub

### 6.2 Modified

- `src/app/layout.tsx` — Mount `<V4TopNav />` und `<V4TabBar />` global. Imports neu, ansonsten Strukturminimal. Bestehende Kommentare (fn-15.5 etc.) bleiben.
- `src/app/page.tsx` (Landing) — `<LandingAuth />` aus dem JSX entfernen (Top-Right-Pill ist jetzt redundant). Import-Statement raus. Beta-Banner-`mt-3` ggf. anpassen auf `mt-6` damit er nicht unter der neuen sticky 64-px-Nav steht.
- `src/components/Layout/AppShell.tsx` — `import { SocialNav }` entfernen, `{!hideSocialNav && <SocialNav />}` entfernen, `hideSocialNav`-Prop deprecaten (Prop annehmen aber ignorieren, damit bestehende `AppShell hideSocialNav` Aufrufe nicht brechen → minimal-scope: keine Touch der Aufrufer). Alternativ: Prop entfernen und Aufrufer mit-fixen — siehe §11 Open Question.
- `src/app/globals.css` — Token-Block (siehe §5) am Ende anhängen.

### 6.3 Untouched

- `src/components/Layout/SocialNav.tsx` — bleibt
- `src/components/Landing/LandingAuth.tsx` — bleibt (kein Mount mehr in `page.tsx`, aber Datei bleibt für mögliche spätere Wiederverwendung)
- Sämtliche Routes-Layouts unter `src/app/*/layout.tsx`, die `<AppShell>` benutzen — bleiben
- Alles unter `src/components/Events/`, `src/components/Map/`, `src/components/Notifications/`

### 6.4 Page-Wrapper-Spacer

Damit der mobile Bottom-Tab-Bar keinen Content überlappt, fügen wir **innerhalb** von `V4TabBar.tsx` einen Geschwister-Spacer ein, der von der gleichen Komponente exportiert wird:

```tsx
// V4TabBar.tsx
export function V4TabBar() {
  return (
    <>
      <nav ...>...</nav>
      <div aria-hidden className="h-[76px] md:hidden" />
    </>
  );
}
```

So mountet das Root-Layout nur `<V4TabBar />` und kriegt beides. Kein extra `<body className="pb-...">` notwendig.

---

## 7. Performance Budget

| Asset | Vorher | Nachher | Delta |
|---|---|---|---|
| Landing Client-JS (Nav) | LandingAuth ~1.2 KB | V4TopNav + V4TopNavAuth + V4TabBar ~3.5 KB | **+2.3 KB gzipped** |
| Landing Critical CSS | ~3 KB | ~3.6 KB | +0.6 KB (Token-Block) |
| Landing HTML | unchanged | +~600 bytes (Nav-Markup) | +0.6 KB |
| Mapbox/Auth/Notifications bundles | not touched | not touched | 0 |
| Font payload | Geist only | Geist only | 0 |

Erwarteter PSI-Impact auf Landing: vernachlässigbar (<1 Punkt). Mobile-Tab-Bar fügt CLS-Risiko hinzu, deshalb der Spacer-Trick in §6.4.

**Verification:** Lighthouse-Run gegen lokalen `npm run build && npm run start` auf `/` vor und nach Implementation. Delta in PSI Performance Score muss ≥ -2 sein, sonst rollback.

---

## 8. Verification Plan (Dev-Preview)

Vor Merge zurück nach master:

1. `npm run dev` — kein Build-Error
2. Browser durch alle relevanten Routes klicken:
   - `/` (Landing, anon + logged-in) — Top-Nav sichtbar, Logo korrekt, Active-State auf "Entdecken"
   - `/entdecken` — Active "Entdecken"
   - `/artists` — Auth-Route, Active "Künstler"
   - `/map` — Active "Karte"
   - `/plans` — 302 → `/saved`, Active "Meine Pläne"
   - `/feed` — Active none (Feed ist nicht in primärer Nav)
   - `/blog` — Active none
   - `/profile` (Mobile) — Active "Profil"
3. Mobile-Viewport (DevTools, 402×874): Bottom-Tab-Bar sichtbar, kein Content-Overlap, Profil-Tab linkt korrekt (anon→`/auth/login`)
4. `npm run build` — alle Routes bauen, ISR-Symbole im Output bleiben für `/` (●)
5. Lokaler Lighthouse-Run vorher/nachher (gegen `npm run start`) — Delta dokumentieren
6. Visual-Regression: Screenshot der Landing oben links/oben rechts vorher/nachher

---

## 9. Edge Cases & Constraints

- **Sticky-Nav + View Transitions**: Bestehende `RouteTransitions`-Logik nutzt `viewTransitionName: 'route-root'` auf dem zentralen `<div>`. Die neue Nav darf dieses Element nicht umschließen — sie bleibt **außerhalb**, sodass die Page-Transition nur den Content animiert, nicht die Chrome.
- **CSP-Hash auf Critical-CSS**: Der `prebuild`/`postbuild`-Hook (`scripts/compute-csp-hash.mjs`) hasht den `CRITICAL_CSS`-Inhalt. Da die `--v4-`-Tokens in `globals.css` (nicht in `lib/critical-css.ts`) landen, ist der CSP-Hash nicht betroffen. Falls Phase 2 die Tokens ins critical-css ziehen will, dann muss der Hash neu berechnet werden — out of scope hier.
- **ISR-Cache-Invalidierung**: Da Root-Layout angefasst wird, invalidiert der nächste Deploy automatisch die gebauten Pages.
- **Service Worker**: `ServiceWorkerProvider` mountet weiterhin in Root. Neue HTML-Struktur invalidiert den SW-Cache beim nächsten Update — Update-Banner-Flow (fn-15.10) greift wie gewohnt.
- **Bell-Notification-Dot ohne NotificationsProvider**: Phase 1 zeigt den Dot konstant on (visual-only). In Phase 4 oder 5 wird ein Lightweight-Realtime-Subscribe ohne Provider-Cascade nachgereicht.
- **`AppShell.hideSocialNav` legacy prop**: Wird in Phase 1 zum No-Op. Aufrufer (`/map/layout.tsx`) bleiben unverändert. Cleanup in einer späteren Aufräum-Phase.

---

## 10. Acceptance Criteria

- [ ] Auf `/`, `/entdecken`, `/map`, `/artists`, `/feed`, `/blog`, `/saved`: V4TopNav sichtbar, korrekte Active-Pill
- [ ] Mobile-Viewport: V4TabBar sichtbar auf allen oben genannten Routes
- [ ] `/plans` → 302-Redirect zu `/saved` (Network-Tab verifiziert)
- [ ] `LandingAuth`-Pille auf Landing **nicht mehr sichtbar** (`page.tsx` bereinigt)
- [ ] `SocialNav` taucht auf **keiner** Route mehr auf (`AppShell` bereinigt)
- [ ] `npm run build` erfolgreich, ISR-Symbol `●` für `/` bleibt
- [ ] Anonymer User sieht in Top-Nav rechts: "Anmelden"-Pill (kein Bell, kein Avatar)
- [ ] Eingeloggter User sieht in Top-Nav rechts: Bell-Icon mit Dot + Avatar-Initial-Pille
- [ ] Profil-Tab anon → `/auth/login`, eingeloggt → `/profile`
- [ ] Active-State korrekt bei Sub-Routes (z.B. `/artists/spotify-import` aktiviert Künstler-Tab)
- [ ] PSI-Performance-Score-Delta auf Landing zwischen -2 und +∞ (kein hartes Regression)
- [ ] Keine TypeScript-Errors
- [ ] Bestehender Vitest-Suite (547 Tests) läuft unverändert grün

---

## 11. Decision Log

| Decision | Rationale |
|---|---|
| Global im Root-Layout mounten | Einzige Layer, die Landing + Auth-Routes + öffentliche Routes gleich erfasst; vermeidet inkonsistente Chrome zwischen `/` und `/entdecken`. |
| `V4TopNavAuth` self-hydratet | Vermeidet AuthProvider-Mount in Root → fn-15.5 Bundle-Win bleibt; gleiches Pattern wie bestehender `LandingAuth`. |
| `--v4-`-Token-Präfix | Keine Kollision mit bestehenden `--color-*`/`--planer-*` Tokens; klar dass Tokens zu v4 gehören; spätere Migration / Abschaffung einfacher. |
| `/plans` als Stub-Redirect | Tab funktioniert visuell, `/saved` rendert weiter wie heute; null Migration-Komplexität für Phase 5. |
| Mobile-Tab-Bar erst ab v4 mit Profil als 5. Tab | Brief-konform; SocialNav hatte Profil im "Mehr"-Sheet, was Friction war. |
| Spacer innerhalb von V4TabBar | Vermeidet globalen `<body>`-Padding, der Desktop unnötig fragmentiert; lokaler `md:hidden` Spacer ist self-contained. |
| Phase 1 fasst Landing-Content nicht an | Trennt Nav-Migration von Content-Redesign; Landing-Section-Redesign passiert sauber in Phase 2. |
| `AppShell.hideSocialNav` Prop bleibt als No-Op | Minimal-scope-Regel: Aufrufer (`/map/layout.tsx`, `/groups/[id]/layout.tsx`) nicht anfassen. Prop akzeptiert aber ignoriert. Cleanup in späterer Aufräum-Phase. |
| Bell-Klick → bestehende `/notifications` Route | Kein neues Modal/Sheet in Phase 1. Realtime-Bell-Sheet kommt in Phase 4/5, wenn Notifications-Layer eh angefasst wird. |
| ⌘K-Pill = nur visuelles Affordance + Click → `/entdecken` | Echter Cmd+K-Listener + Modal mit Künstler/Events-Tabs ist eigenes Feature, kommt mit Phase 2 (Landing/Card-System) wo Search-Modal benötigt wird. Phase 1 hält das Pill nur als visuellen Anker. |
