/**
 * Assembles the full burgenland.json registry from multiple agent research files.
 * Normalizes different schemas, fills in missing coordinates from gem2goGemeinden.ts.
 *
 * Run: npx tsx src/scripts/assemble-registry.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface NormalizedEntry {
  name: string;
  website: string;
  eventUrl: string | null;
  cms: string;
  strategy: string;
  plz: string;
  bezirk: string;
  bundesland: string;
  lat: number;
  lng: number;
  status: string;
  notes: string;
  verifiedAt: string;
}

// Load coordinates from gem2goGemeinden.ts
function loadCoordinates(): Map<string, { lat: number; lng: number; plz: string; bezirk: string }> {
  const content = readFileSync(join(process.cwd(), 'src/lib/scrapers/gemeinden/gem2goGemeinden.ts'), 'utf8');
  const regex = /\{\s*name:\s*'([^']+)',\s*website:\s*'([^']+)',\s*plz:\s*'([^']+)',\s*bezirk:\s*'([^']+)',\s*bundesland:\s*'Burgenland',\s*lat:\s*([\d.]+),\s*lng:\s*([\d.]+)/g;
  const map = new Map<string, { lat: number; lng: number; plz: string; bezirk: string }>();
  let m;
  while ((m = regex.exec(content)) !== null) {
    map.set(m[1], { lat: parseFloat(m[5]), lng: parseFloat(m[6]), plz: m[3], bezirk: m[4] });
  }
  return map;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeEntry(raw: any, coords: Map<string, { lat: number; lng: number; plz: string; bezirk: string }>): NormalizedEntry {
  const name = raw.name;
  const coordData = coords.get(name);

  return {
    name,
    website: raw.website || '',
    eventUrl: raw.eventUrl || raw.eventsUrl || null,
    cms: raw.cms || 'unknown',
    strategy: raw.strategy || 'none',
    plz: raw.plz || coordData?.plz || '',
    bezirk: raw.bezirk || coordData?.bezirk || '',
    bundesland: 'Burgenland',
    lat: raw.lat || coordData?.lat || 0,
    lng: raw.lng || coordData?.lng || 0,
    status: raw.status || 'unknown',
    notes: raw.notes || '',
    verifiedAt: raw.verifiedAt || '2026-04-02',
  };
}

function main() {
  const coords = loadCoordinates();
  console.log(`Loaded ${coords.size} Burgenland municipality coordinates`);

  const allEntries: NormalizedEntry[] = [];
  const seen = new Set<string>();

  // Source 1: Mattersburg + Neusiedl (Agent 2 - correct schema)
  try {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'municipality-research-mattersburg-neusiedl.json'), 'utf8'));
    for (const raw of data) {
      const entry = normalizeEntry(raw, coords);
      if (!seen.has(entry.name)) { seen.add(entry.name); allEntries.push(entry); }
    }
    console.log(`Mattersburg+Neusiedl: ${data.length} entries`);
  } catch (e) { console.log('Skipping mattersburg-neusiedl:', e); }

  // Source 2: Oberpullendorf + Oberwart (Agent 3 - different schema)
  try {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'municipality-research-oberpullendorf-oberwart.json'), 'utf8'));
    for (const raw of data) {
      const entry = normalizeEntry(raw, coords);
      if (!seen.has(entry.name)) { seen.add(entry.name); allEntries.push(entry); }
    }
    console.log(`Oberpullendorf+Oberwart: ${data.length} entries`);
  } catch (e) { console.log('Skipping oberpullendorf-oberwart:', e); }

  // Source 3: Existing test registry (contains Eisenstadt-Umgebung entries from Agent 1)
  // We'll add the Agent 1 entries that aren't already in the file
  // Agent 1 data was returned in conversation - we use the entries from the probe results
  const agent1Entries: Partial<NormalizedEntry>[] = [
    { name: 'Eisenstadt', website: 'https://www.eisenstadt.gv.at', eventUrl: 'https://www.eisenstadt.gv.at/freizeit/veranstaltungskalender/', cms: 'typo3', strategy: 'none', status: 'no-calendar', notes: 'TYPO3 site. Event calendar links to external tourism portal.' },
    { name: 'Rust', website: 'https://www.freistadt-rust.at', eventUrl: 'https://www.freistadt-rust.at/veranstaltungen/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress with Enfold theme.' },
    { name: 'Breitenbrunn am Neusiedler See', website: 'https://www.breitenbrunn.at', eventUrl: 'https://www.breitenbrunn.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform.' },
    { name: 'Donnerskirchen', website: 'https://www.donnerskirchen.at', eventUrl: 'https://www.donnerskirchen.at/donnerskirchen/der-ort/veranstaltungen/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress with Divi.' },
    { name: 'Großhöflein', website: 'https://www.grosshoeflein.at', eventUrl: 'https://www.grosshoeflein.at/events/', cms: 'wordpress-tribe', strategy: 'tribe-html', status: 'active', notes: 'WordPress The Events Calendar (Tribe).' },
    { name: 'Hornstein', website: 'https://hornstein.at', eventUrl: 'https://hornstein.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'empty', notes: 'CITIES platform. Calendar exists but no upcoming events.' },
    { name: 'Klingenbach', website: 'https://klingenbach.at', eventUrl: 'https://klingenbach.at/events/liste/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress. Events archive. Returns 403 on direct fetch sometimes.' },
    { name: 'Leithaprodersdorf', website: 'https://leithaprodersdorf.at', eventUrl: 'https://leithaprodersdorf.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform.' },
    { name: 'Mörbisch am See', website: 'https://moerbisch.gv.at', eventUrl: 'https://moerbisch.com/wo-was-los-ist', cms: 'contao', strategy: 'generic-dates', status: 'active', notes: 'Contao CMS. Tourism site with Feratel Deskline widget.' },
    { name: 'Müllendorf', website: 'https://www.muellendorf.at', eventUrl: 'https://www.muellendorf.at/', cms: 'custom', strategy: 'generic-dates', status: 'active', notes: 'Events on homepage under Aktuell.' },
    { name: 'Neufeld an der Leitha', website: 'https://neufeld-leitha.at', eventUrl: 'https://neufeld-leitha.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform.' },
    { name: 'Oggau am Neusiedler See', website: 'https://www.oggau.at', eventUrl: 'https://www.oggau.at/tourismus/veranstaltungen/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress. External Feratel calendar widget.' },
    { name: 'Oslip', website: 'https://www.oslip.at', eventUrl: 'https://www.oslip.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform. Bilingual German/Croatian.' },
    { name: 'Purbach am Neusiedler See', website: 'https://www.purbach.gv.at', eventUrl: 'https://www.purbach.gv.at/veranstaltungen1.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS. Card-based layout.' },
    { name: 'Sankt Margarethen im Burgenland', website: 'https://st-margarethen.at', eventUrl: 'https://st-margarethen.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES + WordPress. Passionsspiele 2026.' },
    { name: 'Schützen am Gebirge', website: 'https://www.schuetzen-am-gebirge.at', eventUrl: 'https://www.schuetzen-am-gebirge.at/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress. Events on homepage.' },
    { name: 'Siegendorf', website: 'https://siegendorf.gv.at', eventUrl: 'https://siegendorf.gv.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'empty', notes: 'CITIES platform. No upcoming events.' },
    { name: 'Steinbrunn', website: 'https://www.steinbrunn.at', eventUrl: 'https://www.steinbrunn.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform.' },
    { name: 'Trausdorf an der Wulka', website: 'https://www.trausdorf-wulka.at', eventUrl: 'https://www.trausdorf-wulka.at/aktuelles/veranstaltungen/', cms: 'wordpress-mec', strategy: 'jsonld', status: 'active', notes: 'WordPress MEC Plugin, JSON-LD Event schema.' },
    { name: 'Wimpassing an der Leitha', website: 'https://wimpassing-leitha.at', eventUrl: 'https://wimpassing-leitha.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform.' },
    { name: 'Wulkaprodersdorf', website: 'https://www.wulkaprodersdorf.at', eventUrl: 'https://www.wulkaprodersdorf.at/termine/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress Events Manager plugin.' },
    { name: 'Loretto', website: 'https://www.gemeinde-loretto.at', eventUrl: 'https://www.gemeinde-loretto.at/kalender', cms: 'custom', strategy: 'generic-dates', status: 'active', notes: 'Custom CMS. Events in Aktuell section.' },
    { name: 'Stotzing', website: 'https://www.stotzing.at', eventUrl: 'https://www.stotzing.at/', cms: 'custom', strategy: 'generic-dates', status: 'active', notes: 'Custom site. Events in Aktuell section on homepage.' },
    { name: 'Zillingtal', website: 'https://www.zillingtal.eu', eventUrl: 'https://www.zillingtal.eu/termine-und-veranstaltungen', cms: 'custom', strategy: 'generic-dates', status: 'active', notes: 'Custom/GEM2GO-like. Dedicated Termine page.' },
    { name: 'Zagersdorf', website: 'https://www.zagersdorf.at', eventUrl: 'https://www.zagersdorf.at/gemeindekalender/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress with Astra/Elementor. Bilingual.' },
    { name: 'Pöttsching', website: 'https://www.poettsching.at', eventUrl: 'https://www.poettsching.at/Freizeit_Kultur/Veranstaltungen', cms: 'gem2go', strategy: 'gem2go', status: 'active', notes: 'GEM2GO platform.' },
  ];

  for (const raw of agent1Entries) {
    const entry = normalizeEntry({ ...raw, bundesland: 'Burgenland', verifiedAt: '2026-04-02' }, coords);
    if (!seen.has(entry.name)) { seen.add(entry.name); allEntries.push(entry); }
  }
  console.log(`Eisenstadt-Umgebung area: ${agent1Entries.length} entries`);

  // Source 4: Güssing + Jennersdorf (Agent 4 output)
  // Read from the task output notification data - this was returned in conversation
  // We'll add hardcoded entries based on the research results
  const agent4Entries: Partial<NormalizedEntry>[] = [
    { name: 'Bocksdorf', website: 'https://www.bocksdorf.at', eventUrl: null, cms: 'jimdo', strategy: 'none', status: 'no-calendar', notes: 'Jimdo site. No events page.' },
    { name: 'Burgauberg-Neudauberg', website: 'https://www.burgauberg-neudauberg.at', eventUrl: 'https://www.burgauberg-neudauberg.at/system/web/veranstaltung.aspx', cms: 'gem2go', strategy: 'gem2go', status: 'active', notes: 'GEM2GO platform.' },
    { name: 'Eberau', website: 'https://www.eberau.at', eventUrl: 'https://www.eberau.at/veranstaltungen/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress with Tribe Events.' },
    { name: 'Gerersdorf-Sulz', website: 'https://www.gerersdorf-sulz.at', eventUrl: 'https://www.gerersdorf-sulz.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Güssing', website: 'https://www.guessing.co.at', eventUrl: 'https://www.guessing.co.at/veranstaltungen', cms: 'joomla', strategy: 'generic-dates', status: 'active', notes: 'Joomla site.' },
    { name: 'Güttenbach', website: 'https://www.guettenbach.at', eventUrl: null, cms: 'wix', strategy: 'none', status: 'no-calendar', notes: 'Wix site, JS-only.' },
    { name: 'Heiligenbrunn', website: 'https://www.heiligenbrunn.at', eventUrl: 'https://www.heiligenbrunn.at/veranstaltungen/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress.' },
    { name: 'Kukmirn', website: 'https://www.kukmirn.at', eventUrl: 'https://www.kukmirn.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Neuberg im Burgenland', website: 'https://www.neuberg-bgld.at', eventUrl: 'https://www.neuberg-bgld.at/veranstaltungen/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress Tribe Events.' },
    { name: 'Neustift bei Güssing', website: 'https://www.neustift-guessing.at', eventUrl: 'https://www.neustift-guessing.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform.' },
    { name: 'Olbendorf', website: 'https://www.olbendorf.at', eventUrl: 'https://www.olbendorf.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Ollersdorf im Burgenland', website: 'https://www.ollersdorf-burgenland.at', eventUrl: 'https://www.ollersdorf-burgenland.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Sankt Michael im Burgenland', website: 'https://www.st.michael-bgld.at', eventUrl: 'https://www.st.michael-bgld.at/veranstaltungen/', cms: 'typo3', strategy: 'generic-dates', status: 'active', notes: 'TYPO3 site.' },
    { name: 'Stegersbach', website: 'https://www.stegersbach.at', eventUrl: 'https://www.stegersbach.at/veranstaltungen/', cms: 'typo3', strategy: 'generic-dates', status: 'active', notes: 'TYPO3 site.' },
    { name: 'Stinatz', website: 'https://www.stinatz.gv.at', eventUrl: 'https://www.stinatz.gv.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform.' },
    { name: 'Strem', website: 'https://www.strem.co.at', eventUrl: 'https://www.strem.co.at/system/web/veranstaltung.aspx', cms: 'gem2go', strategy: 'gem2go', status: 'active', notes: 'GEM2GO platform.' },
    { name: 'Tobaj', website: 'https://www.tobaj.gv.at', eventUrl: 'https://www.tobaj.gv.at/system/web/veranstaltung.aspx', cms: 'gem2go', strategy: 'gem2go', status: 'active', notes: 'GEM2GO. SSL issues, use HTTP.' },
    { name: 'Hackerberg', website: 'https://www.hackerberg.at', eventUrl: 'https://www.hackerberg.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Wörterberg', website: 'https://www.woerterberg.at', eventUrl: 'https://www.woerterberg.at/veranstaltungen/', cms: 'wordpress-mec', strategy: 'mec-html', status: 'active', notes: 'WordPress MEC.' },
    { name: 'Großmürbisch', website: 'https://www.grossmuerbisch.at', eventUrl: 'https://www.grossmuerbisch.at/system/web/veranstaltung.aspx', cms: 'gem2go', strategy: 'gem2go', status: 'active', notes: 'GEM2GO platform.' },
    { name: 'Inzenhof', website: 'https://www.inzenhof.at', eventUrl: 'https://www.inzenhof.at/veranstaltungen-2019/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress. Old URL path but active.' },
    { name: 'Kleinmürbisch', website: 'https://www.kleinmuerbisch.at', eventUrl: null, cms: 'wordpress', strategy: 'none', status: 'no-calendar', notes: 'WordPress, no events page.' },
    { name: 'Tschanigraben', website: 'https://www.tschanigraben.at', eventUrl: null, cms: 'wordpress', strategy: 'none', status: 'no-calendar', notes: 'WordPress, no events page.' },
    { name: 'Heugraben', website: 'https://www.heugraben.gv.at', eventUrl: 'https://www.heugraben.gv.at/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform with window.INITIAL_DATA.' },
    { name: 'Rohr im Burgenland', website: 'https://www.rohr-bgld.at', eventUrl: null, cms: 'wordpress', strategy: 'none', status: 'no-calendar', notes: 'No events section.' },
    { name: 'Bildein', website: 'https://bildein.at', eventUrl: 'https://bildein.at/termine/', cms: 'wordpress', strategy: 'generic-dates', status: 'active', notes: 'WordPress.' },
    { name: 'Rauchwart', website: 'https://www.rauchwart.at', eventUrl: null, cms: 'wordpress', strategy: 'none', status: 'pdf-only', notes: 'Events only as PDF.' },
    { name: 'Moschendorf', website: 'https://www.moschendorf.at', eventUrl: 'https://citiesapps.com/pages/moschendorf/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform. SSL issues on main site.' },
    { name: 'Deutsch Kaltenbrunn', website: 'https://www.deutschkaltenbrunn.eu', eventUrl: 'https://www.deutschkaltenbrunn.eu/events/upcoming', cms: 'cities', strategy: 'cities-iife', status: 'active', notes: 'CITIES platform.' },
    { name: 'Eltendorf', website: 'https://www.eltendorf.at', eventUrl: 'https://www.eltendorf.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Heiligenkreuz im Lafnitztal', website: 'https://www.heiligenkreuz-lafnitztal.at', eventUrl: 'https://www.heiligenkreuz-lafnitztal.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Jennersdorf', website: 'https://www.jennersdorf.eu', eventUrl: 'https://www.jennersdorf.eu/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Minihof-Liebau', website: 'https://www.minihof-liebau.at', eventUrl: 'https://www.minihof-liebau.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Mogersdorf', website: 'https://www.mogersdorf.at', eventUrl: 'https://www.mogersdorf.at/veranstaltungen', cms: 'custom', strategy: 'generic-dates', status: 'active', notes: 'Custom CMS. Use .at not .gv.at (SSL issues).' },
    { name: 'Neuhaus am Klausenbach', website: 'https://www.neuhaus-klausenbach.at', eventUrl: 'https://www.neuhaus-klausenbach.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Rudersdorf', website: 'https://www.rudersdorf.at', eventUrl: 'https://www.rudersdorf.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Sankt Martin an der Raab', website: 'https://www.sankt-martin.at', eventUrl: 'https://www.sankt-martin.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Weichselbaum', website: 'https://www.gemeinde-weichselbaum.at', eventUrl: 'https://www.gemeinde-weichselbaum.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Königsdorf', website: 'https://www.koenigsdorf.at', eventUrl: 'https://www.koenigsdorf.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
    { name: 'Mühlgraben', website: 'https://www.muehlgraben.at', eventUrl: 'https://www.muehlgraben.at/veranstaltungen.html', cms: 'gemeinde24', strategy: 'gemeinde24', status: 'active', notes: 'Gemeinde24 CMS.' },
  ];

  for (const raw of agent4Entries) {
    const entry = normalizeEntry({ ...raw, bundesland: 'Burgenland', verifiedAt: '2026-04-02' }, coords);
    if (!seen.has(entry.name)) { seen.add(entry.name); allEntries.push(entry); }
  }
  console.log(`Güssing+Jennersdorf: ${agent4Entries.length} entries`);

  // Sort by bezirk, then name
  allEntries.sort((a, b) => {
    const bezirkCmp = a.bezirk.localeCompare(b.bezirk, 'de');
    if (bezirkCmp !== 0) return bezirkCmp;
    return a.name.localeCompare(b.name, 'de');
  });

  // Write output
  const outputPath = join(process.cwd(), 'data', 'gemeinden-registry', 'burgenland.json');
  writeFileSync(outputPath, JSON.stringify(allEntries, null, 2));

  // Summary
  const byStatus: Record<string, number> = {};
  const byStrategy: Record<string, number> = {};
  const byBezirk: Record<string, number> = {};
  for (const e of allEntries) {
    byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    byStrategy[e.strategy] = (byStrategy[e.strategy] || 0) + 1;
    byBezirk[e.bezirk] = (byBezirk[e.bezirk] || 0) + 1;
  }

  console.log(`\n=== REGISTRY ASSEMBLED ===`);
  console.log(`Total: ${allEntries.length} municipalities`);
  console.log(`Unique: ${seen.size}`);
  console.log(`\nBy Status:`);
  Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nBy Strategy:`);
  Object.entries(byStrategy).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nBy Bezirk:`);
  Object.entries(byBezirk).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nSaved to: ${outputPath}`);
}

main();
