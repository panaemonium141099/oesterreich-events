/**
 * Prosa-Felder der Blogposts (history, whatToExpect) in Blöcke zerlegen.
 *
 * Die Saison-Guides schreiben mehrere Absätze, getrennt durch Zeilenumbruch,
 * dazu `## Zwischentitel` und `**fett**`. Die Blogseite rendert das Feld
 * bisher in EINEM <p>: alle Absätze liefen zu einem Block zusammen, und die
 * Christkindlmärkte zeigten „## Die zwei Startregeln" und „**Wien hängt
 * nicht am Advent.**" als rohe Zeichen (Befund 2026-11-04). Mehr Markdown
 * als diese drei Formen gibt es in den Posts nicht, und mehr soll hier auch
 * nicht entstehen.
 */

export interface ProseRun {
  text: string;
  bold: boolean;
}

export type ProseBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; runs: ProseRun[] };

/** `**fett**` in Läufe zerlegen; unpaarige Sterne bleiben Text. */
export function parseRuns(text: string): ProseRun[] {
  const runs: ProseRun[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) runs.push({ text: text.slice(last, idx), bold: false });
    runs.push({ text: m[1], bold: true });
    last = idx + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false });
  return runs;
}

/** Text in Absätze und Zwischentitel zerlegen; Leerzeilen trennen, Einzelumbrüche auch. */
export function parseProse(text: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  for (const raw of text.split(/\r?\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push({ type: 'heading', text: heading[1].trim() });
      continue;
    }
    blocks.push({ type: 'paragraph', runs: parseRuns(line) });
  }
  return blocks;
}
