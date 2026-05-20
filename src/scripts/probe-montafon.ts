import { extractGem2goDetail } from '../lib/scrapers/gem2go-detail';

async function main() {
  const URLS = [
    'https://www.montafon.at/de/abendliche-fuehrung-im-montafoner-heimatmuseum_vc20917',
    'https://www.arte-hotels.at/arte-hotel-kufstein/das-hotel/',
    'https://klangfarben-kufstein.com/',
    'http://www.stadtsaal-kufstein.at/de/',
    'https://www.daskaiser-hotel.at/',
  ];
  for (const url of URLS) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0)' },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const ext = extractGem2goDetail(html);
    console.log(`\n=== ${url} ===`);
    console.log(`HTTP ${res.status}, ${html.length} bytes`);
    console.log(`JSON-LD Event: ${/"@type":\s*"Event"/.test(html)}`);
    console.log(`og:description: ${/property="og:description"/.test(html)}`);
    console.log(`og:image: ${/property="og:image"/.test(html)}`);
    console.log(`Extractor output:`, JSON.stringify(ext, null, 2).slice(0, 500));
  }
}
main().catch(console.error);
