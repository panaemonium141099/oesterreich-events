# v4 Phase 5 — Plan-Wizard + Meine Pläne

**Datum:** 2026-05-15
**Status:** spec for approval

## 1. Ziel

Nutzer können einen "Abend planen" — also einen Plan anlegen, der aus 1-N Events besteht, optional Notizen/Memo hat, ein Datum, und auf den später nochmal zugegriffen werden kann. Plus die Seite `/saved` ("Meine Pläne") restyled zur v4-Übersicht aller Pläne.

Konkrete Use-Cases:
- "Wochenendplan": 3 Konzerte am Samstag, 1 Brunch am Sonntag
- "Date-Abend": ein Event + Bar-Tipp danach
- "Geburtstag Lisa": ein Event als Ausgangspunkt, Notiz "Treffpunkt 18:00 vorm Eingang"
- "Festival-Trip": mehrere Tage, mehrere Events

## 2. UX-Flow

### Plan starten

**Hauptflow (90% der Fälle):**
- User ist auf Event-Detail (z.B. "Seiler und Speer in der Stadthalle")
- Klick auf "Abend planen" CTA in der V4SideBox
- Wizard öffnet sich als Sheet/Modal **mit diesem Event bereits drin** (Step 1 vor-ausgefüllt: Datum = Event-Datum, Name = "Abend in {Stadt}" oder "{Event-Titel}", Event in Step-2-Liste)
- User kann sofort speichern (1 Klick weiter) oder erst weitere Events dazu / Notiz schreiben
- URL: `/plan/new?event={eventId}` — Wizard liest den Param und seeded den State

**Sekundäre Einstiegspunkte:**
2. **TopNav-Link** "Meine Pläne" → `/saved` Empty-State → "+ Neuer Plan" CTA → Wizard **leer**
3. **Direkt** `/plan/new` URL (z.B. shared Link) → Wizard leer
4. **Bestehenden Plan editieren** → `/plan/{id}` → "Bearbeiten" → Wizard mit Plan-State seeded

### Plan-Wizard Mount-Modi

`V4PlanWizard` ist die gleiche Komponente, mit zwei Mount-Modi:

**A) Sheet-Modus (von Event-Detail):**
- Wizard öffnet sich als Sheet/Modal **OVER** der Event-Detail-Page (User-URL bleibt `/events/...`)
- Kein Routing, kein Reload
- Nach Save: Sheet schließt + Toast "Plan gespeichert" + optional Push-Button "Zum Plan"
- Same Pattern wie `EventSheet` schon hat
- Vorteil: smooth, kein Page-Flicker, User bleibt im Kontext

**B) Full-Page-Modus (über `/plan/new`):**
- Wizard mountet als ganze Page (kein Background)
- URL: `/plan/new?event={id}` (Event optional)
- Nach Save: Redirect zu `/plan/{id}`
- Wird genutzt von:
  - Direct-URL (shared Link, Bookmark)
  - "+ Neuer Plan" CTA in `/saved` Empty-State
  - Wizard-Edit-Mode: `/plan/{id}/edit`

Beide Modi nutzen die exakt gleiche `V4PlanWizard`-Komponente, parametrisiert über `mode: 'sheet' | 'page'` + `onClose` callback (für Sheet).

### Plan-Wizard
3-Step modal/sheet (sheet-style auf Mobile, modal auf Desktop):

**Step 1 — Wann + Was**
- Datum-Picker (default: Datum des Ausgangs-Events wenn von Event-Detail aus gestartet)
- Optionaler Plan-Name (default: "Abend in {Stadt}" oder "{Event-Titel}")
- Wenn von Event-Detail gestartet: Event ist schon dabei, sonst leer

**Step 2 — Events hinzufügen**
- Liste der bereits hinzugefügten Events (chronologisch, Remove-Button)
- Such-Pill "Weitere Events suchen..." → opens Mini-Such-Drawer mit /api/events Liste, gefiltert auf Datum ± 1 Tag
- "Überspringen" auch erlaubt — ein Plan kann auch ohne Events nur eine Notiz sein

**Step 3 — Notiz + speichern**
- Freitext-Notiz (optional, z.B. "Treffpunkt vorm Eingang, 18:00")
- Sichtbarkeit: "Nur ich" (default) / "Mit Freunden geteilt" — Phase 5 nur "Nur ich", Sharing kommt in Phase 6
- CTA "Plan speichern" → redirect zu `/plan/{id}`

### Plan-Detail (`/plan/{id}`)
- v4 Hero mit Plan-Name + Datum + Anzahl Events
- Timeline der enthaltenen Events (chronologisch, vertikale Linie zwischen den Karten)
- Notiz als Card oben
- Actions: "Bearbeiten" → öffnet Wizard mit Plan-State, "Löschen" mit Confirm, "Teilen" (Phase 6, jetzt disabled)

### Meine Pläne (`/saved` → wird umbenannt zu `/saved` mit v4 Layout)
- v4 Hero "Meine Pläne / Was hast du dir vorgenommen?"
- Tabs: "Aktuelle Pläne" (future + today) / "Vergangene" (history)
- Plan-Cards (Grid 2-Spalten Desktop, 1-Spalten Mobile): Plan-Name, Datum, Event-Count, Mini-Vorschau erste 2 Events
- Empty-State wenn keine Pläne: "+ Ersten Plan anlegen" CTA
- Existing `/saved` Logik (saved events ohne Plan) wird ein eigener Tab oder als "Gemerkte Events" Section am Boden — Diskussion offen

## 3. Architektur

### DB-Schema (Supabase, neue Migration)

```sql
create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  plan_date date not null,
  note text,
  visibility text not null default 'private',  -- 'private' | 'shared' (Phase 6)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade not null,
  event_id uuid references events(id) not null,
  position int not null default 0,
  added_at timestamptz not null default now(),
  unique(plan_id, event_id)
);

create index idx_plans_user_date on plans(user_id, plan_date desc);
create index idx_plan_items_plan on plan_items(plan_id, position);

-- RLS: nur eigene Pläne lesen/schreiben
alter table plans enable row level security;
create policy "users own their plans" on plans for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table plan_items enable row level security;
create policy "users own their plan_items via plan" on plan_items for all
  using (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()))
  with check (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()));
```

### API-Routes

- `POST /api/plans` — { name, plan_date, note?, event_ids[] } → erstellt plan + plan_items in transaction
- `GET /api/plans` — listet plans des authentifizierten Users (cursor pagination, filter `?scope=upcoming|past`)
- `GET /api/plans/[id]` — einzelner plan mit hydrated events
- `PATCH /api/plans/[id]` — { name?, plan_date?, note?, event_ids? } — Wenn event_ids geliefert: replace komplett
- `DELETE /api/plans/[id]` — Plan + plan_items (cascade)

### Komponenten

**Atoms (`src/components/Events/v4/`):**
- `V4DatePicker.tsx` — minimal v4-styled date input
- `V4Stepper.tsx` — 3-step indicator "1 · 2 · 3" für Wizard

**Plan-Komponenten (`src/components/Plans/v4/`):**
- `V4PlanWizard.tsx` — Modal/Sheet mit 3 Steps, state machine, save handler
- `V4PlanWizardStep1.tsx`, `V4PlanWizardStep2.tsx`, `V4PlanWizardStep3.tsx`
- `V4PlanCard.tsx` — Card-Variante für die Liste
- `V4PlanHero.tsx` — Hero für Plan-Detail
- `V4PlanTimeline.tsx` — vertikale Timeline der Events
- `V4PlanEditActions.tsx` — Edit/Delete/Share Buttons
- `V4PlansList.tsx` — Grid + Tabs (Aktuell/Vergangen)
- `index.ts` — Barrel

**Pages (`src/app/`):**
- `plan/[id]/page.tsx` — Plan-Detail (server-side hydration)
- `plan/new/page.tsx` — Wizard-Start (client, opens Wizard sheet directly)
- `saved/page.tsx` — Re-implementieren für v4 mit Pläne-Übersicht

### State

- Plan-Wizard hat lokalen reducer state (steps, events[], date, name, note)
- Persistence nur auf "Speichern"-CTA → POST /api/plans
- `/saved` und `/plan/[id]` SSR-hydriert, optional client refetch on focus

### Side-Box-CTA-Integration

Im V4SideBox: der `Free`-Box und alle ticket-bearing boxes haben einen "Abend planen" / "Plan öffnen" CTA. Heute linkt der auf `/saved`. Phase 5 ändert das auf:
- Wenn User KEINEN aktiven Plan hat für das Event-Datum → CTA "Abend planen" linkt zu `/plan/new?event={id}`
- Wenn User SCHON einen Plan hat für das Datum → CTA "Plan öffnen" linkt zu `/plan/{id}`

Diese Logik kommt aus `deriveDetailContext` (existing) → hat schon den `inPlan` boolean + planId aufgebohrt.

## 4. Components vs. Pages — Verantwortlichkeiten

- **`/plan/new` page** = thin shell die V4PlanWizard mountet, parsed `?event=` URL-param als initial event
- **`V4PlanWizard`** = stateful client-Component, kennt API, kennt die Steps, kein Routing-Logic (parent regelt)
- **`/plan/[id]` page** = server-RSC, holt plan + events via `getPlan(id)`, rendert Hero + Timeline
- **`/saved` page** = server-RSC, holt plans-list + saved-events, rendert V4PlansList

## 5. Out-of-Scope (Phase 6+)

- Plan teilen mit Friends (visibility=shared, einladen, gemeinsam editieren)
- Push-Benachrichtigungen wenn ein gespeicherter Plan näher rückt
- Plan-Templates ("Wochenend-Abend in Wien", "Festival-Tag")
- iCal-Export
- Existing `/saved` logic (gemerkte Events ohne Plan) — entscheiden ob behalten oder weg

## 6. Akzeptanz

- [ ] DB-Migration plans + plan_items + RLS live
- [ ] POST/GET/PATCH/DELETE /api/plans funktioniert
- [ ] V4PlanWizard 3-Step öffnet sich von Event-Detail "Abend planen" Button
- [ ] Wizard kann Plan speichern → redirect auf /plan/{id}
- [ ] /plan/{id} zeigt Plan-Detail mit Events in Timeline
- [ ] /saved (Meine Pläne) zeigt alle Pläne des Users, Tabs Aktuell/Vergangen
- [ ] Edit-Flow: bestehenden Plan ändern (Events hinzufügen/raus, Notiz ändern)
- [ ] Delete-Flow: Plan löschen mit Confirm
- [ ] V4-Tokens überall verwendet, dark theme konsistent
- [ ] `npm run build` grün, CSP postbuild OK
- [ ] V4-Test-Suite ≥ 200 Tests grün (neue Plan-Tests)
