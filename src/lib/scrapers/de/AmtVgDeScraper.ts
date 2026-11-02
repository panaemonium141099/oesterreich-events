/**
 * Prüfstand der Amts- und VG-Kalender (fn-29.17): Gemeinden ohne eigenen
 * Kalender lesen den ihres Amts bzw. ihrer Verbandsgemeinde (Registry
 * `fallback.kind = 'verband'`). Gelesen wird über die Adapter der
 * jeweiligen Integration, keine eigene Logik: jeder Adapter liest hier nur
 * die Kalender mit `viaVerband`-Gemeinden, die Zeilen tragen seinen
 * `source_name` und seine `source_id`. Ein Termin bekommt nur die Gemeinde,
 * die er selbst nennt (`terminContext`), sonst bleibt der Ort offen.
 *
 * Nicht in `DE_SCRAPERS` und nie im Nachtlauf: dort lesen die Adapter ihre
 * Amtskalender ohnehin mit, ein zweiter Lauf läse sie doppelt.
 */
import { BaseScraper } from '../BaseScraper';
import type { ScrapedEvent } from '@/types/events';
import type { DeFeedScraper } from './feed-scraper';
import { ActiveCityDeScraper } from './ActiveCityDeScraper';
import { AllgemeinDeScraper } from './AllgemeinDeScraper';
import { CommuniceDeScraper } from './CommuniceDeScraper';
import { DigipublicaDeScraper } from './DigipublicaDeScraper';
import { HwDeScraper } from './HwDeScraper';
import { IkissDeScraper } from './IkissDeScraper';
import { IonasDeScraper } from './IonasDeScraper';
import { KommOneDeScraper } from './KommOneDeScraper';
import { MecDeScraper } from './MecDeScraper';
import { NolisDeScraper } from './NolisDeScraper';
import { Open2cDeScraper } from './Open2cDeScraper';
import { TribeDeScraper } from './TribeDeScraper';
import { Typo3DeScraper } from './Typo3DeScraper';
import { WeblicationDeScraper } from './WeblicationDeScraper';

/** Adapter, deren Kalender Gemeinden als Ausweichweg lesen (Registry 2026-10-28). */
export function amtVgAdapters(): DeFeedScraper[] {
  const v = true;
  return [
    new IonasDeScraper(undefined, v), new NolisDeScraper(undefined, v), new TribeDeScraper(undefined, v),
    new MecDeScraper(undefined, v), new HwDeScraper(undefined, v), new IkissDeScraper(undefined, v),
    new KommOneDeScraper(undefined, v), new CommuniceDeScraper(undefined, v), new WeblicationDeScraper(undefined, v),
    new Typo3DeScraper(undefined, v), new AllgemeinDeScraper(undefined, v), new DigipublicaDeScraper(undefined, v),
    new Open2cDeScraper(undefined, v), new ActiveCityDeScraper(undefined, v),
  ];
}

export class AmtVgDeScraper extends BaseScraper {
  readonly name = 'de-amt-vg';

  async scrape(): Promise<ScrapedEvent[]> {
    const all: ScrapedEvent[] = [];
    for (const a of amtVgAdapters()) {
      const events = await a.scrape();
      this.log(`${a.name}: ${events.length} Termine aus Amtskalendern`);
      all.push(...events);
    }
    return all;
  }
}
