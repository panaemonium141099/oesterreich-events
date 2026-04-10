import { BaseScraper } from './BaseScraper';
import { BurgenlandInfoScraper } from './BurgenlandInfoScraper';
import { LandesregierungScraper } from './LandesregierungScraper';
import { EsterházyScraper } from './EsterházyScraper';
import { OhoScraper } from './OhoScraper';
import { NeusiedlerseeScraper } from './NeusiedlerseeScraper';
import { OeticketScraper } from './OeticketScraper';
import { TicketmasterScraper } from './TicketmasterScraper';
import { WienGvScraper } from './WienGvScraper';
import { WienVADBScraper } from './WienVADBScraper';
import { FalterScraper } from './FalterScraper';
import { MeinBezirkScraper } from './MeinBezirkScraper';
import { EventsAtScraper } from './EventsAtScraper';
import { FeverUpScraper } from './FeverUpScraper';
import { StadthalleScraper } from './StadthalleScraper';
import { PraterWienScraper } from './PraterWienScraper';
import { PartytimerScraper } from './PartytimerScraper';
import { WienInfoScraper } from './WienInfoScraper';
import { WienClubsScraper } from './WienClubsScraper';
import { GrazClubsScraper } from './GrazClubsScraper';
import { LinzClubsScraper } from './LinzClubsScraper';
import { SalzburgClubsScraper } from './SalzburgClubsScraper';
import { InnsbruckClubsScraper } from './InnsbruckClubsScraper';
import { KleinstaedteClubsScraper } from './KleinstaedteClubsScraper';
import { TirolScraper } from './TirolScraper';
import { DonauNOEScraper } from './DonauNOEScraper';
import { LinzTermineScraper } from './LinzTermineScraper';
import { KaerntenLiveScraper } from './KaerntenLiveScraper';
import { GrazTourismusScraper } from './GrazTourismusScraper';
import { PopcultureScraper } from './PopcultureScraper';
import { RockhouseScraper, ARGEkulturScraper, SzeneSalzburgScraper } from './SalzburgScrapers';
import { BodenseeVorarlbergScraper } from './BodenseeVorarlbergScraper';
import { VeranstaltungskalenderNetScraper } from './VeranstaltungskalenderNetScraper';
import { EventsTTScraper } from './EventsTTScraper';
import { VorarlbergTravelScraper } from './VorarlbergTravelScraper';
import { BasiskulturScraper } from './BasiskulturScraper';
import { GanzWienScraper } from './GanzWienScraper';
import { PosthofScraper } from './PosthofScraper';
import { KulturGrazScraper } from './KulturGrazScraper';
import { GasteinScraper } from './GasteinScraper';
import { TourismusPortaleScraper } from './TourismusPortaleScraper';
import { GemeindeListScraper } from './GemeindeListScraper';
import { Gem2GoScraper } from './Gem2GoScraper';
import { GenericGemeindeScraper } from './GenericGemeindeScraper';
import { CitiesScraper } from './CitiesScraper';
import { BurgenlandWPEventsScraper } from './BurgenlandWPEventsScraper';
import { GemeindeRegistryScraper } from './GemeindeRegistryScraper';
import { MariazellAtScraper, BasilikaMariazellScraper, MariazellGvScraper } from './MariazellScraper';
import { FeratelScraper } from './FeratelScraper';
import { TourDataScraper } from './TourDataScraper';
import { WienOGDScraper } from './WienOGDScraper';
import { WienTicketScraper } from './WienTicketScraper';
import { TipsAtScraper } from './TipsAtScraper';
import { BergfexScraper } from './BergfexScraper';
import {
  FestivalAtScraper, FestivalGuideScraper,
  ResidentAdvisorAustriaScraper, ClubmapScraper,
  NaturfreundeScraper, AlpenvereinScraper,
  OeAVEventsScraper, LaufenAtScraper, RadNetScraper, OeFBScraper, RunnersFunScraper,
  BundestheaterScraper, TheaterAtScraper,
  KonzerthausScraper, MusikvereinScraper,
  KHMScraper, AlbertinaScraper, MUMOKScraper, BelvedereScraper,
  NHMScraper, TechnischesMuseumScraper, LeopoldMuseumScraper, ArsElectronicaScraper,
  BauernmarktScraper, GenussregionScraper,
  FamiliiiScraper, FamilienUrlaubScraper,
  StadtbekanntScraper, RegionewsScraper,
  WKOScraper, MesseWienScraper, MesseWelsScraper, MesseGrazScraper, AMSScraper,
  MarxHalleScraper,
} from './niche';
import { NtryAtScraper } from './NtryAtScraper';
import { MeetupScraper } from './MeetupScraper';
import {
  UniWienScraper, TUWienScraper, UniGrazScraper, UniInnsbruckScraper,
  WUScraper, MedUniWienScraper, BOKUScraper, TUGrazScraper,
  UniSalzburgScraper, JKUScraper, AAUScraper, MedUniGrazScraper,
  MontanUniScraper, KunstUniLinzScraper, VetMedUniScraper,
  // Batch 2
  AkBildScraper, MozarteumScraper, DonauUniKremsScraper,
  FHJoanneumScraper, HCWScraper, FHStPoeltenScraper, FHSalzburgScraper,
  FHBurgenlandScraper, FHVorarlbergScraper, FHKaerntenScraper, FHWNScraper,
  FHKufsteinScraper, IMCKremsScraper, MCIScraper, FHWienWKWScraper,
  Campus02Scraper, FHGTirolScraper, FernFHScraper, FHBFIWienScraper,
  PHNOEScraper, PHSalzburgScraper, PHKaerntenScraper, PHBurgenlandScraper,
  KPHWienScraper, PPHAugustinumScraper, KPHEdithSteinScraper,
  // Batch 3
  ITULinzScraper, FHTechnikumWienScraper, FHOOEScraper,
  // Batch 4
  MedUniInnsbruckScraper, AngewandteWienScraper, MDWWienScraper, KUGGrazScraper,
} from './uni';
import { closeSharedBrowser } from './puppeteerBrowser';
import { upsertEvent, recordScrapeRun } from '../db/queries';
import { syncEventsToSupabase } from '../db/supabase-sync';
import { runPipeline } from '../pipeline/orchestrator';
import type { ScrapedEvent } from '@/types/events';
import fs from 'fs';
import path from 'path';

const PROGRESS_DIR = path.join(process.cwd(), 'data');

function writeProgress(name: string, data: { status: string; current: number; total: number; eventsFound: number; message: string; startedAt: string }) {
  try {
    if (!fs.existsSync(PROGRESS_DIR)) fs.mkdirSync(PROGRESS_DIR, { recursive: true });
    fs.writeFileSync(path.join(PROGRESS_DIR, `scraper-progress-${name}.json`), JSON.stringify(data));
  } catch { /* ignore */ }
}

function clearProgress(name: string) {
  try {
    const f = path.join(PROGRESS_DIR, `scraper-progress-${name}.json`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } catch { /* ignore */ }
}

export const scrapers: BaseScraper[] = [
  // Burgenland-Quellen
  new BurgenlandInfoScraper(),
  new LandesregierungScraper(),
  new EsterházyScraper(),
  new OhoScraper(),
  new NeusiedlerseeScraper(),
  // Wien-Quellen
  new WienGvScraper(),
  new WienVADBScraper(),
  new FalterScraper(),
  new WienInfoScraper(),
  new StadthalleScraper(),
  new PraterWienScraper(),
  new PartytimerScraper(),
  new WienClubsScraper(),
  new GrazClubsScraper(),
  new LinzClubsScraper(),
  new SalzburgClubsScraper(),
  new InnsbruckClubsScraper(),
  new KleinstaedteClubsScraper(),
  new BasiskulturScraper(),
  new GanzWienScraper(),
  // Niederösterreich
  new DonauNOEScraper(),
  // Oberösterreich
  new LinzTermineScraper(),
  new PosthofScraper(),
  // Steiermark
  new GrazTourismusScraper(),
  new PopcultureScraper(),
  new KulturGrazScraper(),
  new MariazellAtScraper(),
  new BasilikaMariazellScraper(),
  new MariazellGvScraper(),
  // Salzburg
  new RockhouseScraper(),
  new ARGEkulturScraper(),
  new SzeneSalzburgScraper(),
  new GasteinScraper(),
  // Tourismus-Portale (Tirol, Salzburg — regionale Portale)
  new TourismusPortaleScraper(),
  // Feratel Deskline TOSC5 API (55+ Regionen österreichweit)
  new FeratelScraper(),
  // TourData / austria.info API (alle Bundesländer, API key required)
  new TourDataScraper(),
  // Wien Open Government Data (VADB category queries, CC-BY 4.0)
  new WienOGDScraper(),
  // Wien-Ticket (Konzerte, Theater, Sport, Ausstellungen in Wien)
  new WienTicketScraper(),
  // Kärnten
  new KaerntenLiveScraper(),
  // Tirol
  new TirolScraper(),
  new EventsTTScraper(),
  // Vorarlberg
  new BodenseeVorarlbergScraper(),
  new VorarlbergTravelScraper(),
  // Ganz Österreich (multi-region)
  new VeranstaltungskalenderNetScraper(),
  // Übergreifend (Wien + AT)
  new EventsAtScraper(),
  new FeverUpScraper(),
  // Ganz Österreich
  new MeinBezirkScraper(),
  new OeticketScraper(),
  new TicketmasterScraper(),
  // Nischen-Kategorien: Festivals
  new FestivalAtScraper(),
  new FestivalGuideScraper(),
  // Nischen-Kategorien: Nightlife / Clubs
  new ResidentAdvisorAustriaScraper(),
  new ClubmapScraper(),
  // Nischen-Kategorien: Outdoor & Sport
  new NaturfreundeScraper(),
  new AlpenvereinScraper(),
  // Nischen-Kategorien: Sport-Verbände & Laufsport
  new OeAVEventsScraper(),
  new LaufenAtScraper(),
  new RadNetScraper(),
  new OeFBScraper(),
  new RunnersFunScraper(),
  // Nischen-Kategorien: Kultur & Theater
  new BundestheaterScraper(),
  new TheaterAtScraper(),
  // Nischen-Kategorien: Konzerthäuser
  new KonzerthausScraper(),
  new MusikvereinScraper(),
  // Nischen-Kategorien: Museen
  new KHMScraper(),
  new AlbertinaScraper(),
  new MUMOKScraper(),
  new BelvedereScraper(),
  new NHMScraper(),
  new TechnischesMuseumScraper(),
  new LeopoldMuseumScraper(),
  new ArsElectronicaScraper(),
  // Nischen-Kategorien: Märkte & Kulinarik
  new BauernmarktScraper(),
  new GenussregionScraper(),
  // Nischen-Kategorien: Familie
  new FamiliiiScraper(),
  new FamilienUrlaubScraper(),
  // Media-Portale & RSS Feeds
  new TipsAtScraper(),
  new BergfexScraper(),
  new StadtbekanntScraper(),
  new RegionewsScraper(),
  // Business & Trade (WKO, Messen, AMS)
  new WKOScraper(),
  new MesseWienScraper(),
  new MesseWelsScraper(),
  new MesseGrazScraper(),
  new AMSScraper(),
  // Venues (Wien)
  new MarxHalleScraper(),
  // Community & Ticketing Platforms
  new NtryAtScraper(),
  new MeetupScraper(),
  // Gemeinde-Websites (alle Bundesländer)
  new GemeindeListScraper(),
  // GEM2GO CMS Gemeinden (~2.000 Gemeinden österreichweit)
  new Gem2GoScraper(),
  // Generic municipality event pages (non-GEM2GO)
  new GenericGemeindeScraper(),
  // CITIES platform municipalities (citiesapps.com)
  new CitiesScraper(),
  // WordPress event plugin municipalities (Burgenland)
  new BurgenlandWPEventsScraper(),
  new GemeindeRegistryScraper(),
  // Universitäten und Hochschulen (Batch 1 — Top 15 by student count)
  new UniWienScraper(),
  new TUWienScraper(),
  new UniGrazScraper(),
  new UniInnsbruckScraper(),
  new WUScraper(),
  new MedUniWienScraper(),
  new BOKUScraper(),
  new TUGrazScraper(),
  new UniSalzburgScraper(),
  new JKUScraper(),
  new AAUScraper(),
  new MedUniGrazScraper(),
  new MontanUniScraper(),
  new KunstUniLinzScraper(),
  new VetMedUniScraper(),
  // Universitäten und Hochschulen (Batch 2 — FHs, remaining universities, PHs)
  new AkBildScraper(),
  new MozarteumScraper(),
  new DonauUniKremsScraper(),
  new FHJoanneumScraper(),
  new HCWScraper(),
  new FHStPoeltenScraper(),
  new FHSalzburgScraper(),
  new FHBurgenlandScraper(),
  new FHVorarlbergScraper(),
  new FHKaerntenScraper(),
  new FHWNScraper(),
  new FHKufsteinScraper(),
  new IMCKremsScraper(),
  new MCIScraper(),
  new FHWienWKWScraper(),
  new Campus02Scraper(),
  new FHGTirolScraper(),
  new FernFHScraper(),
  new FHBFIWienScraper(),
  // Pädagogische Hochschulen
  new PHNOEScraper(),
  new PHSalzburgScraper(),
  new PHKaerntenScraper(),
  new PHBurgenlandScraper(),
  new KPHWienScraper(),
  new PPHAugustinumScraper(),
  new KPHEdithSteinScraper(),
  // Batch 3 — New FH scrapers
  new ITULinzScraper(),
  new FHTechnikumWienScraper(),
  new FHOOEScraper(),
  // Batch 4 — New university scrapers
  new MedUniInnsbruckScraper(),
  new AngewandteWienScraper(),
  new MDWWienScraper(),
  new KUGGrazScraper(),
];

const SCRAPER_CONCURRENCY = 10;

export async function runAllScrapers(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping gestartet: ${new Date().toISOString()}`);
  console.log(`${scrapers.length} Scraper registriert (${SCRAPER_CONCURRENCY} parallel)`);
  console.log(`${'='.repeat(60)}\n`);

  // Run up to SCRAPER_CONCURRENCY scrapers in parallel using a queue
  const queue = [...scrapers];
  const workers = Array.from({ length: SCRAPER_CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const scraper = queue.shift();
      if (scraper) await runScraper(scraper);
    }
  });
  await Promise.all(workers);

  // Cleanup shared Puppeteer browser instance
  await closeSharedBrowser();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping abgeschlossen: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);
}

export async function runScraper(scraper: BaseScraper): Promise<void> {
  const startedAt = new Date().toISOString();

  writeProgress(scraper.name, {
    status: 'running',
    current: 0,
    total: 0,
    eventsFound: 0,
    message: `Scraping ${scraper.name} (Pipeline)...`,
    startedAt,
  });

  try {
    // Use new quality pipeline: Raw → Normalize → Match → Score
    const result = await runPipeline(scraper);

    // Also write to SQLite as secondary cache
    // Re-scrape is needed for SQLite since pipeline consumed the events
    // For now, SQLite write happens inside the old upsertEvent path
    // TODO: In a future cleanup, SQLite can read from raw_events

    writeProgress(scraper.name, {
      status: result.status === 'error' ? 'error' : 'running',
      current: result.metrics.items_inserted + result.metrics.items_updated,
      total: result.metrics.items_found,
      eventsFound: result.metrics.items_found,
      message: `Pipeline ${result.status}: ${result.metrics.items_inserted} neu, ${result.metrics.items_updated} aktualisiert, ${result.metrics.suppressed_count} suppressed`,
      startedAt,
    });

    console.log(`[${scraper.name}] Pipeline ${result.status}: ${result.metrics.items_found} found, ${result.metrics.items_inserted} new, ${result.metrics.items_updated} updated, ${result.metrics.suppressed_count} suppressed`);
    clearProgress(scraper.name);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${scraper.name}] Pipeline FEHLER: ${message}`);
    writeProgress(scraper.name, {
      status: 'error',
      current: 0,
      total: 0,
      eventsFound: 0,
      message: `Fehler: ${message}`,
      startedAt,
    });
  }
}

export interface ScraperRunResult {
  scraper_name: string;
  status: 'success' | 'error';
  events_found: number;
  events_inserted: number;
  events_updated: number;
  duration_ms: number;
  error_message: string | null;
}

export async function runScraperWithResult(scraper: BaseScraper): Promise<ScraperRunResult> {
  const start = Date.now();

  writeProgress(scraper.name, {
    status: 'running',
    current: 0,
    total: 0,
    eventsFound: 0,
    message: `Scraping ${scraper.name} (Pipeline)...`,
    startedAt: new Date().toISOString(),
  });

  try {
    const result = await runPipeline(scraper);
    clearProgress(scraper.name);

    return {
      scraper_name: scraper.name,
      status: result.status === 'error' ? 'error' : 'success',
      events_found: result.metrics.items_found,
      events_inserted: result.metrics.items_inserted,
      events_updated: result.metrics.items_updated,
      duration_ms: Date.now() - start,
      error_message: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${scraper.name}] Pipeline FEHLER: ${message}`);
    writeProgress(scraper.name, {
      status: 'error',
      current: 0,
      total: 0,
      eventsFound: 0,
      message: `Fehler: ${message}`,
      startedAt: new Date().toISOString(),
    });

    return {
      scraper_name: scraper.name,
      status: 'error',
      events_found: 0,
      events_inserted: 0,
      events_updated: 0,
      duration_ms: Date.now() - start,
      error_message: message,
    };
  }
}

export function getScraperByName(name: string): BaseScraper | undefined {
  return scrapers.find(s => s.name === name);
}

export function getAvailableScrapers(): string[] {
  return scrapers.map(s => s.name);
}
