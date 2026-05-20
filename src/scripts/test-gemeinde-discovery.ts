import { discoverAndParseGemeindeEvents } from '../lib/scrapers/gemeinde-event-discovery';

const HOMEPAGES = [
  'http://www.eisenstadt.gv.at',
  'http://www.donnerskirchen.at',
  'http://www.grosshoeflein.at',
  'http://www.oggau.at',
  'https://www.freistadt-rust.at',
  'http://www.klingenbach.at',
  'http://www.moerbisch.at',
  'http://www.muellendorf.at',
  'https://www.purbach.gv.at',
];

async function main() {
  console.log('Gemeinde event-discovery probe — 9 known-failing gem2go gemeinden\n');
  for (const url of HOMEPAGES) {
    const host = new URL(url).host;
    process.stdout.write(`→ ${host}: `);
    const start = Date.now();
    const { events, eventListUrl } = await discoverAndParseGemeindeEvents(url);
    const ms = Date.now() - start;
    if (events.length > 0) {
      console.log(`${events.length} events (${ms}ms)`);
      console.log(`   listUrl: ${eventListUrl}`);
      console.log(`   sample: "${events[0].title}" on ${events[0].start_date.slice(0, 10)}`);
    } else if (eventListUrl) {
      console.log(`event-list-URL gefunden aber 0 events parsed (${ms}ms) — ${eventListUrl}`);
    } else {
      console.log(`KEIN event-list URL discoverable (${ms}ms)`);
    }
  }
}
main().catch(console.error);
