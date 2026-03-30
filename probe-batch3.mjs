import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';

const gemeinden = [
  { name: "Leopoldsdorf", bundesland: "Niederösterreich", population: 5476, website: "http://www.leopoldsdorf.gv.at" },
  { name: "Sollenau", bundesland: "Niederösterreich", population: 5455, website: "http://www.sollenau.noe.gv.at" },
  { name: "Schärding", bundesland: "Oberösterreich", population: 5414, website: "https://www.schaerding.ooe.gv.at" },
  { name: "Pettenbach", bundesland: "Oberösterreich", population: 5383, website: "http://www.pettenbach.at" },
  { name: "Spielberg", bundesland: "Steiermark", population: 5349, website: "http://www.spielberg.gv.at" },
  { name: "Parndorf", bundesland: "Burgenland", population: 5331, website: "http://www.gemeinde-parndorf.at" },
  { name: "Kirchberg in Tirol", bundesland: "Tirol", population: 5320, website: "https://www.kirchberg-tirol.gv.at" },
  { name: "Rohrbach-Berg", bundesland: "Oberösterreich", population: 5295, website: "http://www.rohrbach-berg.at" },
  { name: "Schrems", bundesland: "Niederösterreich", population: 5263, website: "http://www.schrems.gv.at" },
  { name: "Böheimkirchen", bundesland: "Niederösterreich", population: 5243, website: "http://www.boeheimkirchen.gv.at" },
  { name: "Stadl-Paura", bundesland: "Oberösterreich", population: 5232, website: "http://www.stadl-paura.at" },
  { name: "Bad Gleichenberg", bundesland: "Steiermark", population: 5227, website: "http://www.bad-gleichenberg.gv.at" },
  { name: "Waidhofen an der Thaya", bundesland: "Niederösterreich", population: 5206, website: "https://www.waidhofen-thaya.gv.at" },
  { name: "Grieskirchen", bundesland: "Oberösterreich", population: 5182, website: "http://www.grieskirchen.at" },
  { name: "Henndorf am Wallersee", bundesland: "Salzburg", population: 5167, website: "http://www.henndorf.at" },
  { name: "Gmünd", bundesland: "Niederösterreich", population: 5146, website: "http://www.gmuend.at" },
  { name: "Lengau", bundesland: "Oberösterreich", population: 5127, website: "http://www.gemeindelengau.at" },
  { name: "Mittelberg", bundesland: "Vorarlberg", population: 5108, website: "https://www.gde-mittelberg.at" },
  { name: "Gablitz", bundesland: "Niederösterreich", population: 5105, website: "https://www.gablitz.gv.at" },
  { name: "Altheim", bundesland: "Oberösterreich", population: 5055, website: "https://www.altheim.ooe.gv.at" },
  { name: "Eggendorf", bundesland: "Niederösterreich", population: 5046, website: "https://www.eggendorf.at" },
  { name: "Rottenmann", bundesland: "Steiermark", population: 5027, website: "http://www.rottenmann.gv.at" },
  { name: "Wöllersdorf-Steinabrückl", bundesland: "Niederösterreich", population: 5006, website: "http://www.woellersdorf-steinabrueckl.gv.at" },
  { name: "Neustift im Stubaital", bundesland: "Tirol", population: 5006, website: "https://www.neustift.tirol.gv.at" },
  { name: "Riegersburg", bundesland: "Steiermark", population: 5005, website: "http://www.riegersburg.gv.at" },
  { name: "Bad Aussee", bundesland: "Steiermark", population: 5002, website: "https://ausseerland.salzkammergut.at" },
  { name: "Raaba-Grambach", bundesland: "Steiermark", population: 4983, website: "http://www.raaba-grambach.gv.at" },
  { name: "Birkfeld", bundesland: "Steiermark", population: 4975, website: "http://www.birkfeld.at" },
  { name: "Neudörfl", bundesland: "Burgenland", population: 4971, website: "http://www.neudoerfl.gv.at" },
  { name: "Bad Mitterndorf", bundesland: "Steiermark", population: 4935, website: "http://www.bad.co.at" },
  { name: "Längenfeld", bundesland: "Tirol", population: 4927, website: "http://www.gemeinde-laengenfeld.at" },
  { name: "Ober-Grafendorf", bundesland: "Niederösterreich", population: 4922, website: "https://gemeinde.ober-grafendorf.at" },
  { name: "Admont", bundesland: "Steiermark", population: 4906, website: "https://www.admont.at" },
  { name: "Haiming", bundesland: "Tirol", population: 4900, website: "https://www.haiming.gv.at" },
  { name: "Koblach", bundesland: "Vorarlberg", population: 4896, website: "http://www.koblach.at" },
  { name: "Bisamberg", bundesland: "Niederösterreich", population: 4877, website: "http://www.bisamberg.gv.at" },
  { name: "Eichgraben", bundesland: "Niederösterreich", population: 4793, website: "https://eichgraben.gv.at" },
  { name: "Wieselburg", bundesland: "Niederösterreich", population: 4785, website: "http://www.wieselburg.gv.at" },
  { name: "Ottensheim", bundesland: "Oberösterreich", population: 4771, website: "http://www.ottensheim.at" },
  { name: "Altenberg bei Linz", bundesland: "Oberösterreich", population: 4741, website: "https://www.altenberg.at" },
  { name: "Altenmarkt im Pongau", bundesland: "Salzburg", population: 4708, website: "https://www.altenmarkt.at" },
  { name: "Puchenau", bundesland: "Oberösterreich", population: 4663, website: "https://www.puchenau.at" },
  { name: "Kirchberg an der Raab", bundesland: "Steiermark", population: 4634, website: "https://www.kirchberg-raab.gv.at" },
  { name: "Treffen am Ossiacher See", bundesland: "Kärnten", population: 4601, website: "http://www.treffen.at" },
  { name: "Fieberbrunn", bundesland: "Tirol", population: 4591, website: "https://www.fieberbrunn.gv.at" },
  { name: "Volders", bundesland: "Tirol", population: 4585, website: "https://www.volders.gv.at" },
  { name: "Bad Schallerbach", bundesland: "Oberösterreich", population: 4540, website: "https://www.bad-schallerbach.at" },
  { name: "Wartberg ob der Aist", bundesland: "Oberösterreich", population: 4505, website: "https://www.wartberg-aist.at" },
  { name: "Sinabelkirchen", bundesland: "Steiermark", population: 4485, website: "https://www.sinabelkirchen.gv.at" },
  { name: "Golling an der Salzach", bundesland: "Salzburg", population: 4464, website: "http://www.golling.at" },
  { name: "Deutschfeistritz", bundesland: "Steiermark", population: 4464, website: "http://www.deutschfeistritz.gv.at" },
  { name: "Sankt Veit in der Südsteiermark", bundesland: "Steiermark", population: 4462, website: "https://www.sankt-veit.at" },
  { name: "Bad Leonfelden", bundesland: "Oberösterreich", population: 4433, website: "https://www.bad-leonfelden.ooe.gv.at" },
  { name: "Pinsdorf", bundesland: "Oberösterreich", population: 4381, website: "http://www.pinsdorf.at" },
  { name: "Passail", bundesland: "Steiermark", population: 4379, website: "http://www.passail.gv.at" },
  { name: "Wildschönau", bundesland: "Tirol", population: 4377, website: "http://www.wildschoenau.gv.at" },
  { name: "Thaur", bundesland: "Tirol", population: 4369, website: "https://www.thaur.gv.at" },
  { name: "Ried in der Riedmark", bundesland: "Oberösterreich", population: 4353, website: "https://www.ried-riedmark.at" },
  { name: "Söding-Sankt Johann", bundesland: "Steiermark", population: 4324, website: "http://www.soeding.at" },
  { name: "Luftenberg an der Donau", bundesland: "Oberösterreich", population: 4319, website: "http://www.luftenberg.at" },
  { name: "Wies", bundesland: "Steiermark", population: 4286, website: "https://www.wies.at" },
  { name: "Bad St. Leonhard im Lavanttal", bundesland: "Kärnten", population: 4265, website: "http://www.bad-st-leonhard-i-lav.at" },
];

const PATHS = [
  '/veranstaltungen', '/termine', '/events',
  '/aktuelles/veranstaltungen', '/buergerservice/aktuelles/veranstaltungen',
  '/freizeit/veranstaltungen', '/kultur/veranstaltungen',
  '/freizeit-tourismus/veranstaltungen', '/tourismus/veranstaltungen',
  '/aktuelles/termine', '/buergerservice/termine',
  '/veranstaltungskalender', '/kalender', '/event', '/programm',
];

const EVENT_KEYWORDS = /veranstaltung|termin|event|konzert|fest |vortrag|workshop|ausstellung|lesung|theater|kabarett|flohmarkt|seminar|kurs|programm|buchung|anmeldung|eintritt/gi;
const DATE_PATTERN = /\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\.\s*(Jänner|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)/gi;

const delay = ms => new Promise(r => setTimeout(r, ms));

function fetchUrl(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, timeout);

    const opts = new URL(url);
    const req = mod.get({
      hostname: opts.hostname,
      port: opts.port,
      path: opts.pathname + opts.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EventProbe/1.0)' },
      signal: controller.signal,
      rejectUnauthorized: false,
    }, (res) => {
      // Follow redirects (up to 3)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        clearTimeout(timer);
        let loc = res.headers.location;
        if (loc.startsWith('/')) loc = `${opts.protocol}//${opts.hostname}${loc}`;
        return fetchUrl(loc, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        clearTimeout(timer);
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf-8')); });
      res.on('error', e => { clearTimeout(timer); reject(e); });
    });
    req.on('error', e => { clearTimeout(timer); reject(e); });
  });
}

function scoreHtml(html) {
  const keywords = html.match(EVENT_KEYWORDS) || [];
  const dates = html.match(DATE_PATTERN) || [];
  return { keywordCount: keywords.length, dateCount: dates.length };
}

function findEventLinksInHomepage(html) {
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const eventLinkKeywords = /veranstaltung|termine|events?|kalender|programm|was.ist.los|freizeit/i;
  const found = [];
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]*>/g, '').trim();
    if (eventLinkKeywords.test(href) || eventLinkKeywords.test(text)) {
      found.push(href);
    }
  }
  return [...new Set(found)];
}

async function probeGemeinde(g) {
  const base = g.website.replace(/\/+$/, '');
  const result = {
    name: g.name,
    bundesland: g.bundesland,
    population: g.population,
    website: g.website,
    eventPageUrl: null,
    eventPagePath: null,
    dateCount: 0,
    keywordCount: 0,
    method: null,
  };

  // Phase 1: try standard paths
  for (const path of PATHS) {
    const url = base + path;
    try {
      const html = await fetchUrl(url);
      const { keywordCount, dateCount } = scoreHtml(html);
      if (dateCount >= 2 || keywordCount >= 5) {
        result.eventPageUrl = url;
        result.eventPagePath = path;
        result.dateCount = dateCount;
        result.keywordCount = keywordCount;
        result.method = 'direct-path';
        return result;
      }
      // Keep best so far
      if (keywordCount > result.keywordCount) {
        result.eventPageUrl = url;
        result.eventPagePath = path;
        result.dateCount = dateCount;
        result.keywordCount = keywordCount;
        result.method = 'direct-path-weak';
      }
    } catch (_) {}
    await delay(100);
  }

  // If we already found something decent, return it
  if (result.keywordCount >= 3) return result;

  // Phase 2: homepage link search
  try {
    const homepage = await fetchUrl(base + '/');
    const links = findEventLinksInHomepage(homepage);
    for (const link of links.slice(0, 5)) {
      let fullUrl = link;
      if (link.startsWith('/')) fullUrl = base + link;
      else if (!link.startsWith('http')) fullUrl = base + '/' + link;
      try {
        const html = await fetchUrl(fullUrl);
        const { keywordCount, dateCount } = scoreHtml(html);
        if (dateCount > result.dateCount || keywordCount > result.keywordCount) {
          const parsedUrl = new URL(fullUrl);
          result.eventPageUrl = fullUrl;
          result.eventPagePath = parsedUrl.pathname;
          result.dateCount = dateCount;
          result.keywordCount = keywordCount;
          result.method = 'homepage-link';
        }
      } catch (_) {}
      await delay(100);
    }
  } catch (_) {}

  if (!result.method && result.keywordCount === 0) {
    result.method = 'not-found';
  }

  return result;
}

async function main() {
  const results = [];
  console.log(`Probing ${gemeinden.length} municipalities...`);

  for (let i = 0; i < gemeinden.length; i++) {
    const g = gemeinden[i];
    try {
      const r = await probeGemeinde(g);
      results.push(r);
      if (r.method && r.method !== 'not-found') {
        console.log(`  [${i + 1}/${gemeinden.length}] ${g.name}: ${r.method} => ${r.eventPagePath} (dates:${r.dateCount}, kw:${r.keywordCount})`);
      } else {
        console.log(`  [${i + 1}/${gemeinden.length}] ${g.name}: not found`);
      }
    } catch (e) {
      console.log(`  [${i + 1}/${gemeinden.length}] ${g.name}: ERROR ${e.message}`);
      results.push({
        name: g.name, bundesland: g.bundesland, population: g.population,
        website: g.website, eventPageUrl: null, eventPagePath: null,
        dateCount: 0, keywordCount: 0, method: 'error',
      });
    }

    if ((i + 1) % 10 === 0) {
      console.log(`--- Progress: ${i + 1}/${gemeinden.length} done ---`);
    }
    await delay(500);
  }

  const found = results.filter(r => r.method && !['not-found', 'error'].includes(r.method));
  console.log(`\nDone. Found event pages: ${found.length}/${gemeinden.length}`);

  fs.writeFileSync('data/probe-batch3.json', JSON.stringify(results, null, 2), 'utf-8');
  console.log('Saved to data/probe-batch3.json');
}

main().catch(e => { console.error(e); process.exit(1); });
