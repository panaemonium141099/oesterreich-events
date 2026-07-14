import { BaseScraper } from './BaseScraper';
import { BurgenlandInfoScraper } from './BurgenlandInfoScraper';
import { LandesregierungScraper } from './LandesregierungScraper';
import { EsterházyScraper } from './EsterházyScraper';
import { OhoScraper } from './OhoScraper';
import { NeusiedlerseeScraper } from './NeusiedlerseeScraper';
import { TicketmasterScraper } from './TicketmasterScraper';
import { BoudiccaEventsScraper } from './BoudiccaEventsScraper';
import { WienGvScraper } from './WienGvScraper';
import { WienVADBScraper } from './WienVADBScraper';
import { FalterScraper } from './FalterScraper';
import { MeinBezirkScraper } from './MeinBezirkScraper';
import { EventsAtScraper } from './EventsAtScraper';
import { EventfinderAtScraper } from './EventfinderAtScraper';
import { EventfrogScraper } from './EventfrogScraper';
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
import { syncEventsToSupabase } from '../db/supabase-sync';
import { createClient } from '@supabase/supabase-js';
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
  new EventfinderAtScraper(),
  new EventfrogScraper(),
  new FeverUpScraper(),
  // Ganz Österreich
  new MeinBezirkScraper(),
  new TicketmasterScraper(),
  // Austria-wide open-source aggregator (JKU Linz, GPL-3.0).
  // Adds Vienna + OÖ dense coverage — see BoudiccaEventsScraper.ts notes.
  new BoudiccaEventsScraper(),
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

/**
 * Harte Obergrenze pro Scraper (default 25 min, via SCRAPER_TIMEOUT_MIN
 * überschreibbar). Grund (2026-07-08): `scraper.scrape()` wurde ohne
 * Deadline awaited — hängt ein Upstream-Request (Socket, der nie
 * schließt), kehrt scrape() nie zurück, der Worker-Slot bleibt für immer
 * blockiert und Promise.all(workers) löst nie auf → der ganze Shard
 * hängt bis zum GitHub-timeout-minutes-Kill (im ersten 6-Shard-Lauf so
 * passiert: 4 Shards liefen 150 min, obwohl die letzten echten Writes
 * ~60 min vor dem Kill lagen). Der Timeout reklamiert den Slot: der
 * hängende Scraper wird als Fehler verbucht, der Worker macht weiter.
 * Referenzwerte: die schnellsten Shards waren mit 24 Scrapern in 35–85
 * min fertig, d.h. jeder legitime Scraper lag klar unter 25 min. NB: der
 * abgebrochene Netzwerk-Call läuft im Hintergrund weiter (kein
 * AbortSignal durch alle Scraper gefädelt) — für einen CI-Prozess ok,
 * er stirbt beim Prozess-Ende. */
const DEFAULT_TIMEOUT_MIN = Number(process.env.SCRAPER_TIMEOUT_MIN) || 25;

/**
 * Härtere Obergrenzen für Langläufer. Die Gemeinde-Aggregatoren brechen
 * ihre Schleife selbst per Soft-Budget ab (BaseScraper.softDeadline,
 * default 240 min) und liefern ein Teilergebnis — der harte Timeout hier
 * ist nur noch Backstop für echte Hänger und muss über Soft-Budget +
 * Sync-Phase liegen. meinbezirk lief 24,7 min (Run 2026-07-14) — der
 * 25er-Default war haarscharf.
 */
const SCRAPER_TIMEOUT_OVERRIDES_MIN: Record<string, number> = {
  'gem2go': 280,
  'gemeinden-generic': 280,
  'gemeinde-registry': 280,
  'meinbezirk': 45,
};

function timeoutMsFor(name: string): number {
  return (SCRAPER_TIMEOUT_OVERRIDES_MIN[name] ?? DEFAULT_TIMEOUT_MIN) * 60_000;
}

class ScraperTimeoutError extends Error {
  constructor(name: string, ms: number) {
    super(`Scraper '${name}' timed out nach ${Math.round(ms / 60_000)} min`);
    this.name = 'ScraperTimeoutError';
  }
}

function scrapeWithTimeout(scraper: BaseScraper): Promise<ScrapedEvent[]> {
  const timeoutMs = timeoutMsFor(scraper.name);
  return new Promise<ScrapedEvent[]>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new ScraperTimeoutError(scraper.name, timeoutMs)),
      timeoutMs,
    );
    scraper.scrape().then(
      (events) => { clearTimeout(timer); resolve(events); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Laufzeit-Gewichte in Minuten für die Shard-Verteilung. Quelle: gemessene
 * source_runs-Laufzeiten vom 2026-07-14 (81 Quellen; alles Ungelistete lag
 * ≤2 min → DEFAULT_WEIGHT). Die Gemeinde-Aggregatoren sind Budget-begrenzt
 * (Soft-Budget 240 min + Sync) — ihr Gewicht ist die Budget-Obergrenze,
 * nicht die theoretische Volllaufzeit (gem2go bräuchte ~388 min für alle
 * 2094 Gemeinden; Tagesrotation verteilt die Abdeckung über Läufe).
 * Bei Änderungen nachziehen via:
 *   SELECT source_name, percentile_disc(0.9) WITHIN GROUP (ORDER BY duration_ms)
 *   FROM source_runs GROUP BY 1 ORDER BY 2 DESC;
 */
const DEFAULT_WEIGHT = 3;
const SCRAPER_WEIGHTS: Record<string, number> = {
  // Budget-begrenzte Gemeinde-Aggregatoren (Soft-Budget + Rotation):
  'gem2go': 250,
  'gemeinden-generic': 240,             // 923 Seiten ≈ 225 min, läuft meist komplett durch
  'gemeinde-registry': 250,             // ~1900 Gemeinden, oft Budget-begrenzt
  // Gemessen 2026-07-14 (max_min, mit Headroom aufgerundet):
  'meinbezirk': 30,                     // 24,7
  'veranstaltungskalender.net': 25,     // 21,6
  'marxhalle': 20,                      // 17,6
  'falter': 14,                         // 11,4
  'burgenland.info': 12,                // 9,9
  'neusiedlersee.com': 10,              // 8,0
  'feratel-deskline': 6,                // 4,8 (Seed 80 war massiv zu hoch)
  'wien-clubs': 5,                      // 4,0
  'wien-ticket': 4,                     // 3,3
  // Noch ungemessen (Fehler-/Timeout-Zeilen wurden bis zum Telemetrie-Fix
  // 2026-07-14 still verworfen) — konservative Seeds behalten:
  'boudicca': 60,
  'tourdata': 60,
  'tips.at': 45,
  'eventfrog': 30,
  'events.at': 30,
  'eventfinder.at': 30,
  'wien-ogd': 20,
};

function weightOf(name: string): number {
  return SCRAPER_WEIGHTS[name] ?? DEFAULT_WEIGHT;
}

/**
 * Deterministische, LASTBALANCIERTE Shard-Aufteilung (MASTERPLAN §5, P2).
 * Vorher: alphabetisches round-robin — das packte mehrere Kommunal-
 * Aggregatoren in denselben Shard (Shard 3 → 300-min-Kill), während andere
 * Shards nach 1 min fertig waren. Jetzt LPT-Scheduling: Scraper nach
 * Gewicht absteigend (Namens-Tiebreak für Determinismus), jeder in den
 * aktuell leichtesten Shard. Jeder Scraper landet in genau einem Shard;
 * alle Jobs eines Laufs berechnen dieselbe Zuteilung.
 */
export function getScrapersForShard(shardIndex: number, shardCount: number): BaseScraper[] {
  if (shardCount < 1 || shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error(`Ungültiger Shard: ${shardIndex}/${shardCount}`);
  }
  const sorted = [...scrapers].sort((a, b) =>
    weightOf(b.name) - weightOf(a.name) || a.name.localeCompare(b.name),
  );
  const loads = new Array<number>(shardCount).fill(0);
  const buckets: BaseScraper[][] = Array.from({ length: shardCount }, () => []);
  for (const s of sorted) {
    let lightest = 0;
    for (let i = 1; i < shardCount; i++) {
      if (loads[i] < loads[lightest]) lightest = i;
    }
    buckets[lightest].push(s);
    loads[lightest] += weightOf(s.name);
  }
  return buckets[shardIndex];
}

export async function runAllScrapers(subset?: BaseScraper[]): Promise<void> {
  const list = subset ?? scrapers;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scraping gestartet: ${new Date().toISOString()}`);
  console.log(`${list.length}/${scrapers.length} Scraper (${SCRAPER_CONCURRENCY} parallel)`);
  console.log(`${'='.repeat(60)}\n`);

  // Run up to SCRAPER_CONCURRENCY scrapers in parallel using a queue
  const queue = [...list];
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

/**
 * Best-effort-Telemetrie nach source_runs — die Datengrundlage für das
 * lastbalancierte Sharding (SCRAPER_WEIGHTS oben aus echten Laufzeiten
 * nachziehen). Fire-and-forget: Telemetrie darf nie einen Scrape killen;
 * ohne Service-Key (lokale Runs) wird still übersprungen.
 */
async function recordSourceRun(row: {
  source_name: string;
  events_found: number;
  events_upserted: number;
  duration_ms: number;
  status: 'success' | 'error' | 'timeout';
  error_message: string | null;
}): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    const sb = createClient(url, key, { auth: { persistSession: false } });
    // supabase-js wirft NICHT — Fehler kommen im Result-Objekt. Genau so
    // gingen bis 2026-07-14 alle error-/timeout-Zeilen still verloren
    // (CHECK-Constraint kannte die Status-Werte nicht).
    const { error } = await sb
      .from('source_runs')
      .insert({ ...row, run_at: new Date().toISOString() });
    if (error) {
      console.warn(`[telemetry] source_runs insert failed (${row.source_name}): ${error.message}`);
    }
  } catch (e) {
    console.warn(`[telemetry] source_runs insert failed (${row.source_name}):`, e instanceof Error ? e.message : e);
  }
}

export async function runScraper(scraper: BaseScraper): Promise<void> {
  // Supabase is the single source of truth — no local SQLite dual-write.
  let eventsFound = 0;
  let eventsNew = 0;
  let eventsUpdated = 0;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  writeProgress(scraper.name, {
    status: 'running',
    current: 0,
    total: 0,
    eventsFound: 0,
    message: `Scraping ${scraper.name}...`,
    startedAt,
  });

  try {
    const events: ScrapedEvent[] = await scrapeWithTimeout(scraper);
    eventsFound = events.length;

    writeProgress(scraper.name, {
      status: 'running',
      current: 0,
      total: eventsFound,
      eventsFound,
      message: `${eventsFound} Events gefunden, speichere...`,
      startedAt,
    });

    // Sync all scraped events to Supabase (single write path).
    if (events.length > 0) {
      const { upserted, errors: syncErrors, filtered } = await syncEventsToSupabase(events);
      eventsNew = upserted;
      eventsUpdated = Math.max(0, eventsFound - upserted - filtered);
      console.log(`[${scraper.name}] Supabase sync: ${upserted} upserted, ${syncErrors} errors${filtered > 0 ? `, ${filtered} filtered (past/invalid)` : ''}`);

      writeProgress(scraper.name, {
        status: 'running',
        current: eventsFound,
        total: eventsFound,
        eventsFound: eventsNew + eventsUpdated,
        message: `Sync done (${upserted} upserted).`,
        startedAt,
      });
    }

    console.log(`[${scraper.name}] Fertig: ${eventsFound} gefunden, ${eventsNew} neu, ${eventsUpdated} aktualisiert`);
    clearProgress(scraper.name);
    await recordSourceRun({
      source_name: scraper.name,
      events_found: eventsFound,
      events_upserted: eventsNew,
      duration_ms: Date.now() - startedMs,
      status: 'success',
      error_message: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${scraper.name}] FEHLER: ${message}`);
    await recordSourceRun({
      source_name: scraper.name,
      events_found: eventsFound,
      events_upserted: 0,
      duration_ms: Date.now() - startedMs,
      status: err instanceof ScraperTimeoutError ? 'timeout' : 'error',
      error_message: message.slice(0, 500),
    });
    writeProgress(scraper.name, {
      status: 'error',
      current: 0,
      total: 0,
      eventsFound,
      message: `Fehler: ${message}`,
      startedAt,
    });
  }
}

export function getScraperByName(name: string): BaseScraper | undefined {
  return scrapers.find(s => s.name === name);
}

export function getAvailableScrapers(): string[] {
  return scrapers.map(s => s.name);
}
