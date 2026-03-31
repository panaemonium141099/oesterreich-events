# Agent Prompt: Blog-System + Automation Agents

## Kontext

LassTreffen.at ist eine oesterreichische Event-Discovery-Plattform. Next.js 16 + React 19 + Supabase + Mapbox GL JS. ~98 Scraper, 41k+ Events, Social Features.

Die App ist DEPLOYED und LIVE auf lasstreffen.at (Hetzner + Coolify + Cloudflare). Ein vorheriger Agent hat Event-Scoring, Landing Page Upgrade, SEO und Deployment-Readiness erledigt. Events haben jetzt einen event_score (0-100), die Landing Page hat "Highlights", "Kategorien" und "Regionen" Sektionen, SEO steht (OG Tags, sitemap, robots.txt, JSON-LD).

**ZIEL: Blog-System komplett aufbauen + AI Automation Agents die den Blog fuellen und Datenqualitaet sichern. Am Ende soll der Blog erste Inhalte haben und die Agents als Cron-faehige Scripts bereitstehen.**

---

## BEVOR DU ANFAENGST

```bash
git pull
npm install
npm run build
```

Build MUSS sauber durchlaufen. Wenn nicht: Fixen bevor du weitermachst.

---

## Task 1: Blog-System — Datenbank & API

### 1.1 Supabase Migration

Datei: `supabase/migrations/20260402_create_blog_system.sql`

```sql
-- Blog Posts Tabelle
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  content TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  cover_image_url TEXT,
  category TEXT NOT NULL DEFAULT 'tipps',
  tags TEXT[] DEFAULT '{}',
  author_type TEXT NOT NULL DEFAULT 'system' CHECK (author_type IN ('system', 'admin', 'ai_generated')),
  author_name TEXT NOT NULL DEFAULT 'LassTreffen Redaktion',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  seo_title TEXT,
  seo_description TEXT,
  related_event_ids UUID[] DEFAULT '{}',
  related_bundesland TEXT,
  view_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_category ON blog_posts(category);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);

-- RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Jeder kann veroeffentlichte Posts lesen
CREATE POLICY "Public can read published posts"
  ON blog_posts FOR SELECT
  USING (status = 'published');

-- Admins und Gods koennen alles
CREATE POLICY "Admins can manage blog posts"
  ON blog_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'god')
    )
  );

-- Service Role kann alles (fuer AI Agents)
CREATE POLICY "Service role full access"
  ON blog_posts FOR ALL
  USING (auth.role() = 'service_role');
```

### 1.2 TypeScript Types

Datei: `src/types/blog.ts`

```typescript
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  content: string; // Markdown
  excerpt: string;
  cover_image_url: string | null;
  category: BlogCategory;
  tags: string[];
  author_type: 'system' | 'admin' | 'ai_generated';
  author_name: string;
  status: 'draft' | 'published' | 'archived';
  seo_title: string | null;
  seo_description: string | null;
  related_event_ids: string[];
  related_bundesland: string | null;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type BlogCategory = 'festivals' | 'nightlife' | 'regionen' | 'tipps' | 'kultur' | 'kulinarik' | 'outdoor' | 'familie';

export const BLOG_CATEGORIES: { value: BlogCategory; label: string }[] = [
  { value: 'festivals', label: 'Festivals & Events' },
  { value: 'nightlife', label: 'Nightlife & Clubs' },
  { value: 'regionen', label: 'Regionen entdecken' },
  { value: 'tipps', label: 'Tipps & Guides' },
  { value: 'kultur', label: 'Kultur & Kunst' },
  { value: 'kulinarik', label: 'Wein & Kulinarik' },
  { value: 'outdoor', label: 'Outdoor & Natur' },
  { value: 'familie', label: 'Familie & Kinder' },
];
```

### 1.3 Blog API Routes

**GET /api/blog** — Blog-Posts auflisten

Datei: `src/app/api/blog/route.ts`

Query-Parameter:
- `status` (default: 'published')
- `category` (optional)
- `limit` (default: 12)
- `offset` (default: 0)

Sortierung: published_at DESC

**GET /api/blog/[slug]** — Einzelnen Post laden

Datei: `src/app/api/blog/[slug]/route.ts`

- Laedt Post nach slug
- Incrementiert view_count
- Laedt related Events (related_event_ids -> Events aus Supabase)

**POST /api/blog** — Post erstellen (nur admin/god/service_role)

Datei: In gleicher route.ts wie GET

- Slug automatisch aus Titel generieren (toLowerCase, replace spaces mit -, Umlaute ersetzen)
- Validierung: title, content, excerpt required
- Status default: 'draft'

**PATCH /api/blog/[slug]** — Post updaten (nur admin/god/service_role)

**DELETE /api/blog/[slug]** — Post loeschen (nur admin/god)

### Akzeptanzkriterien Task 1
- [ ] Migration SQL erstellt
- [ ] Types in src/types/blog.ts
- [ ] Alle 4 API Routes funktionieren (GET list, GET single, POST, PATCH)
- [ ] RLS Policies korrekt (public liest published, admin schreibt alles)
- [ ] Build laeuft ohne Fehler

---

## Task 2: Blog-System — Frontend

### 2.1 Blog-Uebersicht

Datei: `src/app/blog/page.tsx`

- Server Component mit Metadata (title: "Blog | LassTreffen.at")
- Fetch von /api/blog?limit=12
- Featured Post oben gross (erster Post, grosse Karte mit Bild + Titel + Excerpt)
- Grid darunter: 3 Spalten desktop, 2 tablet, 1 mobile
- Kategorie-Filter oben (horizontale Chips, klickbar)
- Jede Blog-Karte: cover_image (next/image), Kategorie-Badge, Titel, Excerpt (2 Zeilen), Datum, Autor
- Framer Motion fade-in Animation
- "Mehr laden" Button am Ende (offset-basiert)
- Leer-State: "Noch keine Blog-Posts vorhanden" mit schoener Illustration

### 2.2 Blog-Detail

Datei: `src/app/blog/[slug]/page.tsx`

- Server Component mit dynamischer Metadata (generateMetadata):
  - title: post.seo_title || post.title
  - description: post.seo_description || post.excerpt
  - openGraph.images: post.cover_image_url
  - JSON-LD: BlogPosting Schema
- Layout:
  - Cover Image gross oben (volle Breite, max-height 400px)
  - Kategorie Badge + Datum + Autor
  - Titel (gross) + Subtitle
  - Content als Markdown gerendert (installiere `react-markdown` + `remark-gfm` fuer GitHub Flavored Markdown)
  - Styling fuer Markdown: Tailwind Typography Plugin oder eigene Styles fuer h2, h3, p, ul, ol, blockquote, code, img
- Sidebar oder Sektion unten: "Verwandte Events" (related_event_ids als EventCard Components)
- Social Share Buttons: Link kopieren, Twitter/X teilen (kein externes Paket, einfache URL-basierte Share Links)
- "Zurueck zum Blog" Link oben
- Responsive: Content max-width 720px zentriert

### 2.3 Blog in Navigation

- Header Component (src/components/Layout/Header.tsx): "Blog" Link hinzufuegen in der Navigation
- Landing Page: "Aus dem Blog" Sektion hinzufuegen (3 neueste Posts als Vorschau-Karten)
  - Neue Component: `src/components/Landing/BlogPreview.tsx`
  - Fetch von /api/blog?limit=3
  - Unter den bestehenden Landing-Sektionen, vor Footer
  - "Alle Beitraege →" Link zum /blog

### 2.4 Admin Blog-Editor

Datei: `src/app/admin/blog/page.tsx` (oder als neuer Tab im bestehenden Admin Panel)

Einfacher Editor:
- Liste aller Blog-Posts (draft + published) mit Status-Badge
- "Neuer Post" Button -> Formular:
  - Titel (Input)
  - Slug (auto-generiert, editierbar)
  - Subtitle (Input, optional)
  - Kategorie (Select aus BLOG_CATEGORIES)
  - Tags (Comma-separated Input)
  - Cover Image URL (Input)
  - Excerpt (Textarea, max 300 Zeichen)
  - Content (Textarea, Markdown — kein WYSIWYG noetig, Markdown reicht)
  - Related Bundesland (Select, optional)
  - SEO Title (Input, optional)
  - SEO Description (Textarea, optional)
  - Status (Select: draft/published)
- Speichern -> POST /api/blog oder PATCH /api/blog/[slug]
- Live-Vorschau des Markdown Content (Split-View: links Editor, rechts Vorschau mit react-markdown)
- "Veroeffentlichen" Button der Status auf 'published' setzt und published_at auf jetzt

### Akzeptanzkriterien Task 2
- [ ] /blog zeigt Blog-Uebersicht mit Kategorie-Filter
- [ ] /blog/[slug] zeigt Blog-Detail mit Markdown-Rendering
- [ ] Blog in Header-Navigation verlinkt
- [ ] BlogPreview auf Landing Page zeigt 3 neueste Posts
- [ ] Admin Blog-Editor funktioniert (erstellen, bearbeiten, veroeffentlichen)
- [ ] Responsive auf Mobile, Tablet, Desktop
- [ ] SEO: OG Tags, JSON-LD BlogPosting Schema auf Detail-Seiten
- [ ] Build laeuft ohne Fehler

---

## Task 3: QA-Pruefer Agent

### Was er tut
Prueft jedes Event auf Qualitaet und fixt was automatisch fixbar ist.

### Implementierung

Datei: `src/scripts/agent-qa.ts`

**3.1 Supabase Migration fuer Agent-Alerts:**

Datei: `supabase/migrations/20260402_create_agent_alerts.sql`

```sql
CREATE TABLE IF NOT EXISTS agent_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  issue_type TEXT NOT NULL,
  message TEXT NOT NULL,
  auto_fixed BOOLEAN DEFAULT false,
  fix_details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_alerts_severity ON agent_alerts(severity);
CREATE INDEX idx_agent_alerts_agent ON agent_alerts(agent_name);
CREATE INDEX idx_agent_alerts_created ON agent_alerts(created_at DESC);

ALTER TABLE agent_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read alerts"
  ON agent_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'god')
    )
  );

CREATE POLICY "Service role full access"
  ON agent_alerts FOR ALL
  USING (auth.role() = 'service_role');
```

Ausserdem: Neues Feld auf events:

```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS quality_score FLOAT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS quality_issues TEXT[] DEFAULT '{}';
```

**3.2 QA Script:**

Datei: `src/scripts/agent-qa.ts`

Das Script:

1. Holt alle Events mit start_date >= heute aus Supabase (Batches von 500)
2. Pro Event folgende Checks:

**Bild-Check:**
- image_url leer oder null -> Issue: 'missing_image', severity: warning
- image_url vorhanden -> HTTP HEAD Request, Status != 200 -> Issue: 'broken_image', severity: warning
  - Auto-Fix: Setze image_url auf null (damit Frontend Kategorie-Fallback nimmt)

**Datum-Check:**
- start_date in der Vergangenheit (> 1 Tag alt) -> Issue: 'past_event', severity: info
- start_date > 2 Jahre in der Zukunft -> Issue: 'implausible_date', severity: warning
- end_date < start_date -> Issue: 'end_before_start', severity: warning
  - Auto-Fix: Setze end_date auf null

**Beschreibung-Check:**
- description leer oder null -> Issue: 'missing_description', severity: info
- description < 20 Zeichen -> Issue: 'short_description', severity: info
- description enthaelt HTML Tags -> Issue: 'html_in_description', severity: info
  - Auto-Fix: HTML Tags strippen

**Koordinaten-Check:**
- latitude/longitude null -> Issue: 'missing_coordinates', severity: warning
- latitude < 46.3 oder > 49.1 oder longitude < 9.5 oder > 17.2 (ausserhalb Oesterreich Bounding Box) -> Issue: 'coordinates_outside_austria', severity: critical
  - Auto-Fix: Setze latitude/longitude auf null

**Duplikat-Check:**
- Fuer jedes Event: Suche nach anderen Events mit:
  - Levenshtein-Distanz des Titels < 5 (oder titel_normalized identisch)
  - Gleiches start_date (Tag)
  - Gleiche Stadt/PLZ
- Wenn Duplikat gefunden -> Issue: 'potential_duplicate', severity: warning, message enthaelt ID des anderen Events
- KEIN Auto-Fix (Duplikate brauchen manuelles Review)

**Kategorie-Check (einfach, ohne AI):**
- Keyword-basierte Plausibilitaet:
  - Titel enthaelt "Konzert/Band/DJ/Live" aber Kategorie != Musik/Nightlife -> Issue: 'category_mismatch', severity: info
  - Titel enthaelt "Wanderung/Radtour/Lauf" aber Kategorie != Sport/Natur -> Issue: 'category_mismatch'
  - Titel enthaelt "Markt/Flohmarkt/Bauernmarkt" aber Kategorie != Maerkte -> Issue: 'category_mismatch'

3. Pro Event: quality_score berechnen (100 - Punkte pro Issue: critical=-30, warning=-15, info=-5)
4. Update Events mit quality_score und quality_issues Array
5. Alerts in agent_alerts Tabelle schreiben
6. Log-Zusammenfassung:
   - "QA Run: X Events geprueft"
   - "Y Issues gefunden (Z critical, W warning, V info)"
   - "A auto-fixes angewendet"
   - Top 10 kritischste Events mit Issues

**3.3 npm Script:**

```json
"agent:qa": "tsx src/scripts/agent-qa.ts"
```

### Akzeptanzkriterien Task 3
- [ ] Migration fuer agent_alerts + quality Felder erstellt
- [ ] QA Script prueft alle 6 Issue-Typen
- [ ] Auto-Fixes funktionieren (broken images, end_before_start, html stripping, outside austria)
- [ ] quality_score pro Event berechnet
- [ ] Alerts in agent_alerts geschrieben
- [ ] Zusammenfassungs-Log am Ende
- [ ] `npm run agent:qa` laeuft fehlerfrei durch

---

## Task 4: Content-Creator Agent

### Was er tut
Generiert Blog-Posts basierend auf aktuellen Events. Nutzt die Anthropic API (Claude) fuer Textgenerierung.

### Implementierung

Datei: `src/scripts/agent-content.ts`

**4.1 Dependency:**

```bash
npm install @anthropic-ai/sdk
```

.env.example ergaenzen:
```
ANTHROPIC_API_KEY=sk-ant-xxx
```

**4.2 Content Script:**

Das Script generiert 3 Blog-Post Typen:

**Typ 1: "Wochenend-Highlights"**
- Holt Top 10 Events der naechsten 7 Tage (sortiert nach event_score)
- Generiert einen Blog-Post der diese Events vorstellt
- Prompt an Claude Haiku:

```
Du bist der Redakteur von LassTreffen.at, einer oesterreichischen Event-Plattform.
Schreibe einen Blog-Post auf Deutsch (oesterreichisches Deutsch) ueber die Highlights der kommenden Woche.

Hier sind die Top Events:
{events als JSON: title, start_date, location_name, bundesland, category, description (erste 200 Zeichen), event_score}

Regeln:
- Titel: Kurz, catchy, mit aktuellem Datum/Woche (z.B. "Die besten Events vom 3.-9. April 2026")
- Laenge: 800-1200 Woerter
- Struktur: Einleitung, dann jedes Event kurz vorstellen (2-3 Saetze), Fazit
- Ton: Locker, einladend, oesterreichisch (aber nicht zu umgangssprachlich)
- Format: Markdown mit ## Ueberschriften pro Event
- KEINE erfundenen Details, NUR Infos aus den Event-Daten verwenden

Antworte NUR mit dem Blog-Post in Markdown, kein anderer Text.
```

- Slug: `wochenend-highlights-{kalenderwoche}-{jahr}` (z.B. wochenend-highlights-kw14-2026)
- Kategorie: 'tipps'
- related_event_ids: IDs der verwendeten Events

**Typ 2: "Bundesland Spotlight"**
- Waehlt ein zufaelliges Bundesland das in den letzten 4 Wochen kein Spotlight hatte
- Holt Top 8 Events in diesem Bundesland
- Generiert Blog-Post der das Bundesland und seine Events vorstellt

Prompt an Claude Haiku:
```
Du bist der Redakteur von LassTreffen.at.
Schreibe einen Blog-Post auf Deutsch ueber Events in {bundesland}, Oesterreich.

Events:
{events als JSON}

Regeln:
- Titel: z.B. "Was ist los in {bundesland}? Die besten Events im April"
- Laenge: 600-1000 Woerter
- Kurze Intro ueber die Region, dann Events vorstellen
- Ton: Locker, einladend, oesterreichisch
- Format: Markdown
- NUR Infos aus den Event-Daten verwenden

Antworte NUR mit dem Blog-Post in Markdown.
```

- Slug: `events-in-{bundesland-lowercase}-{monat}-{jahr}`
- Kategorie: 'regionen'
- related_bundesland: das Bundesland

**Typ 3: "Kategorie Deep-Dive"**
- Waehlt eine Kategorie die in den letzten 2 Wochen kein Deep-Dive hatte
- Holt Top 8 Events dieser Kategorie
- Generiert thematischen Blog-Post

Slug: `{kategorie}-events-{monat}-{jahr}`
Kategorie: Passende Blog-Kategorie

**4.3 Workflow des Scripts:**

1. Check: Welcher Post-Typ ist am laengsten nicht erstellt worden?
2. Generiere den entsprechenden Post
3. Erstelle Excerpt (erste 160 Zeichen des Contents, bereinigt)
4. SEO Title und Description generieren (nochmal kurzer Claude-Call oder aus Titel/Excerpt ableiten)
5. Speichere als POST /api/blog (oder direkt Supabase Insert via Service Role)
6. Status: 'draft' (Admin muss reviewen und publishen)
   - OPTIONAL: Wenn --auto-publish Flag gesetzt: Status direkt 'published'
7. Log: "Created blog post: '{titel}' (type: {typ}, status: draft)"

**4.4 npm Script:**

```json
"agent:content": "tsx src/scripts/agent-content.ts",
"agent:content:publish": "tsx src/scripts/agent-content.ts --auto-publish"
```

### Akzeptanzkriterien Task 4
- [ ] @anthropic-ai/sdk installiert
- [ ] Content Script generiert alle 3 Post-Typen
- [ ] Posts werden korrekt in blog_posts Tabelle gespeichert
- [ ] Slugs sind unique und korrekt formatiert
- [ ] related_event_ids korrekt verknuepft
- [ ] --auto-publish Flag funktioniert
- [ ] `npm run agent:content` laeuft fehlerfrei
- [ ] Mindestens 1 Test-Post generiert und in der DB

---

## Task 5: Quellen-Waechter Agent

### Was er tut
Ueberwacht ob Scraper noch funktionieren und meldet Anomalien.

### Implementierung

Datei: `src/scripts/agent-watcher.ts`

**5.1 Scraper-Statistik Tabelle:**

Datei: `supabase/migrations/20260402_create_scraper_stats.sql`

```sql
CREATE TABLE IF NOT EXISTS scraper_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  event_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_name, run_date)
);

CREATE INDEX idx_scraper_stats_source ON scraper_stats(source_name);
CREATE INDEX idx_scraper_stats_date ON scraper_stats(run_date DESC);

ALTER TABLE scraper_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON scraper_stats FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can read"
  ON scraper_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'god')
    )
  );
```

**5.2 Watcher Script:**

1. Fuer jeden bekannten Scraper (source_name aus events Tabelle, DISTINCT):
   - Zaehle Events mit created_at in den letzten 24h
   - Zaehle Gesamt-Events
   - Speichere in scraper_stats
2. Vergleiche mit Durchschnitt der letzten 7 Tage:
   - Scraper liefert 0 Events UND hatte vorher > 0: Alert severity 'critical', issue_type 'scraper_dead'
   - Scraper liefert > 50% weniger als 7-Tage-Schnitt: Alert severity 'warning', issue_type 'scraper_decline'
   - Scraper liefert > 200% mehr als normal: Alert severity 'info', issue_type 'scraper_spike' (koennte auch gut sein)
3. Alerts in agent_alerts Tabelle schreiben
4. Log-Zusammenfassung:
   - "Watcher Run: X Scraper geprueft"
   - "Y Alerts (Z critical, W warning)"
   - Tabelle mit: source_name | today | avg_7d | status

**5.3 npm Script:**

```json
"agent:watcher": "tsx src/scripts/agent-watcher.ts"
```

### Akzeptanzkriterien Task 5
- [ ] Migration fuer scraper_stats erstellt
- [ ] Watcher zaehlt Events pro Scraper korrekt
- [ ] Vergleich mit 7-Tage-Durchschnitt funktioniert
- [ ] Alerts werden in agent_alerts geschrieben
- [ ] Dead Scraper werden als critical erkannt
- [ ] `npm run agent:watcher` laeuft fehlerfrei

---

## Task 6: Admin Agent-Dashboard

### Was zu tun ist

Im bestehenden Admin Panel (`src/app/admin/page.tsx`) einen neuen Tab "Agents" hinzufuegen (oder eigene Seite `src/app/admin/agents/page.tsx`).

**Dashboard zeigt:**

1. **Agent-Alerts Uebersicht:**
   - Tabelle mit: Datum, Agent, Severity (farbcodiert: rot/gelb/blau), Event-Titel (verlinkt), Issue, Auto-Fixed?
   - Filter: nach Severity, nach Agent, nach Zeitraum
   - Sortierung: neueste zuerst

2. **Scraper-Health:**
   - Tabelle aus scraper_stats: Source | Heute | 7d-Schnitt | Status (OK/Warning/Dead)
   - Farbcodierung: Gruen = OK, Gelb = Decline, Rot = Dead

3. **Blog-Posts Status:**
   - Drafts (noch nicht veroeffentlicht, vom Content Agent erstellt)
   - Quick-Publish Button pro Draft
   - Link zum Blog-Editor

4. **Letzte Runs:**
   - Wann lief QA Agent zuletzt? Wann Content Agent? Wann Watcher?
   - (Aus agent_alerts created_at pro agent_name ableiten)

### Akzeptanzkriterien Task 6
- [ ] Agent-Dashboard im Admin Panel erreichbar
- [ ] Alerts-Tabelle mit Filtern und Farbcodierung
- [ ] Scraper-Health Uebersicht
- [ ] Blog-Drafts sichtbar mit Publish-Button
- [ ] Letzte Run-Zeiten pro Agent

---

## Task 7: Erste Blog-Inhalte generieren + Finaler Test

### Was zu tun ist

1. Content Agent ausfuehren: `npm run agent:content`
   - Soll mindestens 3 Posts generieren (1x Wochenend-Highlights, 1x Bundesland Spotlight, 1x Kategorie Deep-Dive)
   - Wenn --auto-publish: Posts sind direkt live
   - Wenn nicht: Im Admin manuell publishen

2. QA Agent ausfuehren: `npm run agent:qa`
   - Soll alle Events pruefen
   - Issues loggen
   - Auto-Fixes anwenden

3. Watcher Agent ausfuehren: `npm run agent:watcher`
   - Soll Scraper-Health pruefen
   - Stats in scraper_stats schreiben

4. Finaler Build-Test:
```bash
npm run build
```
MUSS fehlerfrei durchlaufen.

5. Pruefen:
   - /blog zeigt die generierten Posts
   - /blog/[slug] zeigt Post-Detail mit Markdown korrekt gerendert
   - Landing Page zeigt Blog-Vorschau
   - Admin Dashboard zeigt Agent-Alerts und Scraper-Health
   - /api/blog liefert Posts korrekt

### Akzeptanzkriterien Task 7
- [ ] Mindestens 3 Blog-Posts in der Datenbank
- [ ] /blog zeigt Posts korrekt
- [ ] /blog/[slug] rendert Markdown korrekt
- [ ] Landing Page Blog-Vorschau funktioniert
- [ ] QA Agent hat Issues geloggt
- [ ] Watcher Agent hat Scraper-Stats geschrieben
- [ ] Admin Agent-Dashboard zeigt Daten
- [ ] `npm run build` laeuft FEHLERFREI

---

## Reihenfolge der Ausfuehrung

1. **Blog DB + API** (Task 1 — Grundlage fuer alles)
2. **Blog Frontend** (Task 2 — braucht API von Task 1)
3. **QA Agent** (Task 3 — unabhaengig vom Blog, kann parallel gedacht werden)
4. **Content Agent** (Task 4 — braucht Blog API von Task 1)
5. **Watcher Agent** (Task 5 — unabhaengig)
6. **Admin Dashboard** (Task 6 — braucht agent_alerts von Task 3+5)
7. **Erste Inhalte + Finaler Test** (Task 7 — ganz am Ende)

---

## Wichtige Regeln

- KEIN `ignoreBuildErrors: true`. TypeScript Errors FIXEN.
- Alle neuen Dateien in TypeScript (.ts/.tsx).
- Framer Motion fuer Animationen (ist installiert).
- next/image fuer alle Bilder.
- react-markdown + remark-gfm installieren fuer Blog-Rendering.
- Markdown Content im Blog soll gut aussehen (Tailwind Typography oder custom Styles).
- Am Ende MUSS `npm run build` sauber durchlaufen.
- Committe nach jedem erledigten Task.
- ANTHROPIC_API_KEY wird fuer den Content Agent gebraucht. Wenn nicht in .env.local vorhanden: Script soll saubere Fehlermeldung geben und abbrechen.
