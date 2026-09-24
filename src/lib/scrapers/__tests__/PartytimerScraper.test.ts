import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PartytimerScraper } from '../PartytimerScraper';

// Seite 1 von https://www.partytimer.at/events, Abruf 2026-09-24.
const HTML = readFileSync(join(__dirname, 'fixtures', 'partytimer-events.html'), 'utf-8');
const NOW = new Date('2026-09-24T08:00:00Z');

describe('PartytimerScraper.parsePage', () => {
  const events = new PartytimerScraper().parsePage(HTML, NOW);

  it('liest alle zehn Karten mit echtem Titel statt Badge-Text', () => {
    expect(events).toHaveLength(10);
    expect(events.map(e => e.title)).toContain('Voodoo Jürgens & Die Ansa Panier / Euroteuro');
    for (const e of events) {
      expect(e.title).not.toMatch(/^Event\b/);
      expect(e.title).not.toMatch(/\s{2,}|\n/);
    }
  });

  it('übernimmt Datum, Uhrzeit und Ort der eigenen Karte', () => {
    const klub = events.find(e => e.source_id === 'partytimer-1683089');
    expect(klub).toMatchObject({
      title: 'Klub66',
      description: '(Pensionisten Clubbing, Anmeldung!)',
      start_date: '2026-09-24T17:00:00',
      location_name: 'U4',
      postal_code: '1120',
      city: 'Wien',
      source_url: 'https://www.partytimer.at/events/1683089',
    });

    const bueroschluss = events.find(e => e.source_id === 'partytimer-1526212');
    expect(bueroschluss).toMatchObject({
      title: 'Büroschluss',
      start_date: '2026-09-24T18:00:00',
      location_name: 'O - der Klub',
      postal_code: '1010',
    });
  });

  it('überspringt Karten ohne Namen statt "Event" zu veröffentlichen', () => {
    const noName = HTML.replace(/(<div class="text-2xl font-bold font-display mt-2">)Klub66(<\/div>)/, '$1$2');
    const parsed = new PartytimerScraper().parsePage(noName, NOW);
    expect(parsed).toHaveLength(9);
    expect(parsed.find(e => e.source_id === 'partytimer-1683089')).toBeUndefined();
  });

  it('legt Jänner-Termine einer Dezember-Liste ins Folgejahr', () => {
    const jan = HTML.replace('Do 24.9.</p>', 'Fr 8.1.</p>');
    const parsed = new PartytimerScraper().parsePage(jan, new Date('2026-12-20T10:00:00Z'));
    expect(parsed.find(e => e.source_id === 'partytimer-1683089')?.start_date).toBe('2027-01-08T17:00:00');
  });
});
