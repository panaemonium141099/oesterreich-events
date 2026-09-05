/**
 * Klarnamen für die Workflows.
 *
 * Die Berichte trugen als Überschrift den technischen Slug
 * ("blog-autowriter") und sagten nirgends, was der Job überhaupt tut oder
 * wann er läuft. Wer die Mail morgens im Postfach hat, soll ohne
 * Vorwissen einordnen können, worum es geht — deshalb hier je Workflow
 * ein Name, ein Satz zum Zweck und der Fahrplan.
 *
 * Ein unbekannter Slug ist kein Fehler: dann steht der Slug selbst als
 * Name da, und die Zusatzzeilen entfallen. So kann ein neuer Job sofort
 * berichten, auch wenn er hier noch nicht eingetragen ist.
 */

export interface WorkflowInfo {
  /** Wie der Workflow in Betreff und Überschrift heißt. */
  name: string;
  /** Ein Satz: was tut der Job? */
  purpose: string;
  /** Wann er läuft, in Worten. */
  schedule: string;
}

const CATALOG: Record<string, WorkflowInfo> = {
  'blog-autowriter': {
    name: 'Blog-Autowriter',
    purpose: 'Schreibt SEO-Blogposts zu kommenden Events und veröffentlicht sie direkt.',
    schedule: 'täglich 07:23 Wien, sonntags zusätzlich ein Unterkunfts-Guide',
  },
  'scrape-pipeline': {
    name: 'Scrape-Pipeline',
    purpose:
      'Holt Events von ~144 Quellen, normalisiert und kategorisiert sie, geocodiert, bewertet und entfernt Duplikate.',
    schedule: 'täglich 05:17 Wien',
  },
  'import-eventim': {
    name: 'Eventim-Import',
    purpose: 'Liest den Eventim-PFT-Feed ein und setzt die Affiliate-Deeplinks.',
    schedule: 'alle 6 Stunden',
  },
  'ingest-activities': {
    name: 'Freizeit-POI-Ingest',
    purpose: 'Aktualisiert die Freizeitaktivitäten aus Deskline und OpenStreetMap.',
    schedule: 'wöchentlich',
  },
  'translate-events': {
    name: 'Übersetzung Events',
    purpose: 'Übersetzt Event-Titel und -Beschreibungen ins Englische für die /en-Seiten.',
    schedule: 'alle 3 Stunden',
  },
  'translate-activities': {
    name: 'Übersetzung Freizeit-POIs',
    purpose: 'Übersetzt die POI-Beschreibungen ins Englische für die /en-Seiten.',
    schedule: 'alle 3 Stunden',
  },
  'refresh-viator': {
    name: 'Viator-Produkte',
    purpose: 'Frischt die Affiliate-Angebote zu den Freizeitzielen auf.',
    schedule: 'täglich',
  },
  'saison-guide': {
    name: 'Saison-Guide',
    purpose: 'Baut die saisonalen Übersichtsseiten neu.',
    schedule: 'wöchentlich',
  },
};

export function workflowInfo(slug: string): WorkflowInfo | null {
  return CATALOG[slug] ?? null;
}

/** Anzeigename — fällt auf den Slug zurück, wenn der Workflow neu ist. */
export function workflowName(slug: string): string {
  return CATALOG[slug]?.name ?? slug;
}
