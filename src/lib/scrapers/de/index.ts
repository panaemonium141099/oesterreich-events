/**
 * DE-Gemeinde-Adapter (Epic fn-29). Bewusst NICHT in `scrapers` (index.ts):
 * ein Adapter kommt erst in den Nachtlauf, wenn sein Prüfstand bestanden ist
 * (fn-29.18). Bis dahin nutzt ihn nur `npm run pruefstand:de`.
 */
import type { BaseScraper } from '../BaseScraper';
import { IonasDeScraper } from './IonasDeScraper';
import { NolisDeScraper } from './NolisDeScraper';
import { TribeDeScraper } from './TribeDeScraper';
import { EventsManagerDeScraper } from './EventsManagerDeScraper';
import { MecDeScraper } from './MecDeScraper';
import { DpCalendarDeScraper } from './DpCalendarDeScraper';

export const DE_SCRAPERS: BaseScraper[] = [new IonasDeScraper(), new NolisDeScraper(), new TribeDeScraper(), new EventsManagerDeScraper(), new MecDeScraper(), new DpCalendarDeScraper()];

export function getDeScraperByName(name: string): BaseScraper | undefined {
  return DE_SCRAPERS.find(s => s.name === name);
}
