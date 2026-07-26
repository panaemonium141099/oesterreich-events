/**
 * FAQPage JSON-LD builder.
 *
 * Produces schema.org/FAQPage entries that can land a site in Google's
 * Rich Results + Featured Snippets + ChatGPT / Perplexity citations.
 * The five rules we follow here for a ranked FAQPage:
 *
 *   1. Questions sound like real search queries ("Was kostet …?"),
 *      not pitch copy ("Entdecke unsere Events!").
 *   2. Answers are 2–4 sentences — long enough to rank, short enough
 *      that Google can lift the whole answer into the snippet.
 *   3. Every answer includes at least one concrete number, named
 *      entity, or local anchor ("Wiener Rathaus", "täglich aktualisiert",
 *      "kostenlos") so it doesn't read like generic boilerplate.
 *   4. Same questions NEVER appear on two pages — each context (theme /
 *      gemeinde / bundesland) gets a tailored set. Duplicate FAQs across
 *      many pages is what triggers "duplicate-content" penalties on
 *      structured data.
 *   5. Minimum 3 QAs per FAQPage (Google's effective threshold for
 *      Rich Results eligibility).
 *
 * All builders are pure functions — take the page context, return the
 * JSON-LD object. Callers embed it in their own `@graph` array.
 */

export interface FAQEntry {
  question: string;
  answer: string;
}

export interface FAQPageSchema {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }>;
}

/** Wraps a set of Q/A pairs in the FAQPage schema shape. */
export function buildFAQPageSchema(entries: FAQEntry[]): FAQPageSchema | null {
  if (entries.length < 3) return null; // Google needs ≥3 for Rich Results.
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

// ───────────────────────────────────────────────────────────────────────
// Context-specific generators
// ───────────────────────────────────────────────────────────────────────

/**
 * FAQ entries for a theme hub at `/thema/<slug>`.
 * `category` is the display name (e.g. "Kultur & Bühne"); `eventCount` is
 * the live Austria-wide total so we can drop concrete numbers into the
 * answers.
 */
export function faqForTheme(params: {
  slug: string;
  category: string;
  heroNoun: string; // short noun phrase for the first sentence — "Konzerte", "Theater-Events"
  eventCount: number;
}): FAQEntry[] {
  const { category, heroNoun, eventCount } = params;
  const nice = eventCount.toLocaleString('de-AT');

  const theme = category.split(' & ')[0]; // "Kultur & Bühne" → "Kultur"

  return [
    {
      question: `Wie viele ${heroNoun} gibt es aktuell in Österreich?`,
      answer: `LassTreffen.at listet derzeit ${nice} Veranstaltungen in der Kategorie ${category} für ganz Österreich. Die Datenbank wird täglich aus offiziellen Ticket-Anbietern, Gemeinde-Kalendern und Tourismus-Portalen aktualisiert.`,
    },
    {
      question: `Wo finde ich ${heroNoun} in meiner Nähe?`,
      answer: `Auf der interaktiven Karte unter /map lassen sich alle ${category.toLowerCase()}-Events nach Standort filtern. Zusätzlich gibt es pro Bundesland eigene Übersichtsseiten (z. B. /wien/${params.slug}, /steiermark/${params.slug}) mit lokalem Fokus.`,
    },
    {
      question: `Ist LassTreffen.at kostenlos nutzbar?`,
      answer: `Ja, die gesamte Event-Suche ist kostenlos und ohne Registrierung zugänglich. Ticket-Preise werden – wenn vom Veranstalter verfügbar – direkt auf der Event-Detailseite angezeigt; Kauf und Abwicklung laufen über den jeweiligen Ticket-Anbieter.`,
    },
    {
      question: `Wie aktuell ist die Event-Liste für ${theme}?`,
      answer: `Die ${theme}-Events werden mehrmals täglich aus über 140 Quellen neu eingelesen. Abgesagte oder verschobene Termine werden automatisch erkannt und entsprechend gekennzeichnet.`,
    },
    {
      question: `Kann ich als Veranstalter eigene ${theme}-Events eintragen?`,
      answer: `Ja — über das Einreich-Formular lassen sich eigene Veranstaltungen vorschlagen. Einreichungen werden moderiert und bei Qualitätseignung öffentlich sichtbar geschaltet.`,
    },
  ];
}

/**
 * FAQ entries for a Gemeinde hub at `/gemeinde/<slug>`.
 * `gemeinde` is the display name (e.g. "Eisenstadt"), `bundesland` is the
 * containing region, `eventCount` is the count within the 10 km radius.
 */
export function faqForGemeinde(params: {
  gemeinde: string;
  bundesland: string;
  plz: string;
  eventCount: number;
}): FAQEntry[] {
  const { gemeinde, bundesland, plz, eventCount } = params;
  const nice = eventCount.toLocaleString('de-AT');

  return [
    {
      question: `Welche Events gibt es heute in ${gemeinde}?`,
      answer: `Aktuell finden sich auf LassTreffen.at ${nice} Veranstaltungen im Umkreis von 10 km um ${gemeinde} (${plz}, ${bundesland}). Die Liste reicht von Dorffesten und Märkten bis zu Konzerten, Sport-Events und Kulturveranstaltungen — täglich aus offiziellen Quellen aktualisiert.`,
    },
    {
      question: `Wie werden die Events für ${gemeinde} gesammelt?`,
      answer: `Die Termine kommen aus Gemeinde-Kalendern (${gemeinde} + Nachbarorte), Tourismus-Portalen des ${bundesland}, Ticket-Anbietern und regionalen Veranstaltungs-Feeds. Dubletten werden automatisch zusammengeführt, damit du keine Ankündigung doppelt liest.`,
    },
    {
      question: `Sind auch Events aus Nachbar-Gemeinden zu ${gemeinde} aufgeführt?`,
      answer: `Ja — der 10-km-Radius um ${gemeinde} umfasst automatisch Veranstaltungen in den Nachbarorten. Eine Liste der nächstgelegenen Orte mit eigener Event-Übersicht findet sich weiter unten auf der Seite.`,
    },
    {
      question: `Kann ich ein Event in ${gemeinde} selbst eintragen?`,
      answer: `Ja, Vereine, Veranstalter und Privatpersonen können eigene Termine über das Einreich-Formular vorschlagen. Die Einträge werden moderiert und bei Qualitätseignung öffentlich gelistet — in der Regel innerhalb von 24 Stunden.`,
    },
  ];
}

/**
 * FAQ entries for the "Freizeit & Ausflüge" content of a Gemeinde hub
 * (fn-18 Task 4). Used standalone in the activity-only case (<3 events,
 * ≥3 activities) — the event-focused `faqForGemeinde` set would make
 * claims about an event list the page doesn't show. In the combined
 * case the page appends the first entry of this set to `faqForGemeinde`.
 */
export function faqForGemeindeActivities(params: {
  gemeinde: string;
  bundesland: string;
  plz: string;
  activityCount: number;
}): FAQEntry[] {
  const { gemeinde, bundesland, plz, activityCount } = params;
  const nice = activityCount.toLocaleString('de-AT');

  return [
    {
      question: `Welche Freizeitaktivitäten gibt es in ${gemeinde} und Umgebung?`,
      answer: `LassTreffen.at listet aktuell ${nice} Freizeitaktivitäten und Ausflugsziele im Umkreis um ${gemeinde} (${plz}, ${bundesland}) — von Bädern, Museen und Burgen bis zu Wander-, Rad- und Familienzielen. Jede Aktivität hat eine eigene Seite mit Öffnungszeiten, Karte und Anfahrt.`,
    },
    {
      question: `Woher kommen die Ausflugsziele für ${gemeinde}?`,
      answer: `Die Einträge stammen aus den offiziellen Tourismus-Datenbanken der Regionen (Feratel Deskline), die auch die örtlichen Tourismusverbände in ${bundesland} pflegen. Dauerhaft geschlossene Betriebe werden automatisch erkannt und aus den Listen entfernt.`,
    },
    {
      question: `Sind die Freizeitaktivitäten rund um ${gemeinde} auch bei Regen geeignet?`,
      answer: `Viele der gelisteten Ziele sind Indoor-Aktivitäten wie Hallenbäder, Thermen, Museen oder Kletterhallen. Auf der jeweiligen Detailseite ist gekennzeichnet, ob eine Aktivität indoor, outdoor oder gemischt ist — so lässt sich der Ausflug wetterunabhängig planen.`,
    },
    {
      question: `Was kostet der Eintritt bei Ausflugszielen rund um ${gemeinde}?`,
      answer: `Wo die Betreiber Preise veröffentlichen, zeigt LassTreffen.at einen Preis-Hinweis direkt auf der Aktivitätsseite. Viele Ziele wie Wanderwege, Naturdenkmäler oder Spielplätze sind kostenlos zugänglich; verbindliche Preise nennt immer der Betreiber.`,
    },
  ];
}

/**
 * FAQ entries for a Bundesland or Stadt landing page. `where` is the
 * display name (e.g. "Wien"), `category` is either null (pure
 * Bundesland-Page) or the category display name (combined
 * bundesland × category page).
 */
export function faqForBundesland(params: {
  where: string;
  category: string | null;
  timeFilter: 'heute' | 'wochenende' | null;
}): FAQEntry[] {
  const { where, category, timeFilter } = params;
  const timeLabel = timeFilter === 'heute'
    ? 'heute'
    : timeFilter === 'wochenende'
    ? 'am Wochenende'
    : '';
  const categoryNoun = category
    ? `${category}-Events`
    : 'Veranstaltungen';

  const whereWith = timeLabel ? `${timeLabel} in ${where}` : `in ${where}`;

  return [
    {
      question: `Was ist ${whereWith} los?`,
      answer: `Auf LassTreffen.at findest du aktuelle ${categoryNoun} ${whereWith} — von großen Konzerten und Festivals bis zu Stadtteil-Festen, Märkten und Clubnächten. Die Übersicht wird mehrmals täglich aktualisiert.`,
    },
    {
      question: `Wie finde ich ${categoryNoun} ${whereWith} auf einer Karte?`,
      answer: `Jedes Event ist auf der interaktiven Karte unter /map verortet. Dort lassen sich Events nach Standort, Kategorie und Zeitraum filtern — ideal um zu sehen, was direkt in der Nähe ist.`,
    },
    {
      question: `Woher kommen die ${categoryNoun} für ${where}?`,
      answer: `Die Einträge werden aus offiziellen Ticket-Anbietern (Eventim, oeticket), Tourismus-Portalen des jeweiligen Bundeslands, Gemeinde-Kalendern und Veranstaltungs-Aggregatoren zusammengeführt. Dubletten werden dabei automatisch gefiltert.`,
    },
    {
      question: `Ist die Nutzung der Event-Übersicht für ${where} kostenlos?`,
      answer: `Ja, das Durchsuchen und Filtern ist vollständig kostenlos und funktioniert ohne Anmeldung. Wer Events speichern, Freund:innen einladen oder Künstler:innen folgen möchte, kann optional ein kostenfreies Konto anlegen.`,
    },
  ];
}
