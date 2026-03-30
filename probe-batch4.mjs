import https from 'https';
import http from 'http';
import fs from 'fs';

const gemeinden = [
  {rank:187,name:"Retz",bundesland:"Niederösterreich",population:4253,website:"http://www.retz.gv.at"},
  {rank:188,name:"Gössendorf",bundesland:"Steiermark",population:4237,website:"http://www.goessendorf.at"},
  {rank:189,name:"Theresienfeld",bundesland:"Niederösterreich",population:4218,website:"https://www.theresienfeld.gv.at"},
  {rank:190,name:"Mäder",bundesland:"Vorarlberg",population:4217,website:"https://maeder.at"},
  {rank:191,name:"St. Margarethen an der Raab",bundesland:"Steiermark",population:4209,website:"https://www.st-margarethen-raab.at"},
  {rank:192,name:"Irdning-Donnersbachtal",bundesland:"Steiermark",population:4202,website:"http://www.irdning-donnersbachtal.gv.at"},
  {rank:193,name:"Tiefgraben",bundesland:"Oberösterreich",population:4200,website:"http://www.tiefgraben.at"},
  {rank:194,name:"Zwentendorf an der Donau",bundesland:"Niederösterreich",population:4195,website:"http://www.zwentendorf-donau.gv.at"},
  {rank:195,name:"Götzens",bundesland:"Tirol",population:4188,website:"http://www.goetzens.gv.at"},
  {rank:196,name:"Jennersdorf",bundesland:"Burgenland",population:4168,website:"https://www.jennersdorf.eu"},
  {rank:197,name:"Schalchen",bundesland:"Oberösterreich",population:4154,website:"http://www.schalchen.at"},
  {rank:198,name:"Gaweinstal",bundesland:"Niederösterreich",population:4134,website:"http://www.gaweinstal.at"},
  {rank:199,name:"Ottnang am Hausruck",bundesland:"Oberösterreich",population:4114,website:"http://www.ottnang.at"},
  {rank:200,name:"Inzing",bundesland:"Tirol",population:4112,website:"https://www.inzing.gv.at"},
  {rank:201,name:"Buchkirchen",bundesland:"Oberösterreich",population:4110,website:"http://www.buchkirchen.at"},
  {rank:202,name:"Sankt Gilgen",bundesland:"Salzburg",population:4072,website:"http://www.gemgilgen.at"},
  {rank:203,name:"Bramberg am Wildkogel",bundesland:"Salzburg",population:4062,website:"http://www.bramberg.at"},
  {rank:204,name:"Bleiburg",bundesland:"Kärnten",population:3989,website:"http://www.bleiburg.gv.at"},
  {rank:205,name:"Anger",bundesland:"Steiermark",population:3988,website:"http://www.anger.gv.at"},
  {rank:206,name:"Mondsee",bundesland:"Oberösterreich",population:3981,website:"http://www.gemeinde-mondsee.at"},
  {rank:207,name:"Fußach",bundesland:"Vorarlberg",population:3977,website:"http://www.fussach.at"},
  {rank:208,name:"Mayrhofen",bundesland:"Tirol",population:3975,website:"https://www.mayrhofen.gv.at"},
  {rank:209,name:"Bad Waltersdorf",bundesland:"Steiermark",population:3948,website:"http://www.bad-waltersdorf.gv.at"},
  {rank:210,name:"Langenwang",bundesland:"Steiermark",population:3901,website:"http://www.langenwang.at"},
  {rank:211,name:"Hinterbrühl",bundesland:"Niederösterreich",population:3895,website:"http://www.hinterbruehl.gv.at"},
  {rank:212,name:"Loosdorf",bundesland:"Niederösterreich",population:3890,website:"http://www.loosdorf.gv.at"},
  {rank:213,name:"Waizenkirchen",bundesland:"Oberösterreich",population:3881,website:"http://www.waizenkirchen.at"},
  {rank:214,name:"Piesendorf",bundesland:"Salzburg",population:3863,website:"https://www.piesendorf.salzburg.at"},
  {rank:215,name:"Pischelsdorf am Kulm",bundesland:"Steiermark",population:3862,website:"http://www.pischelsdorf-kulm.gv.at"},
  {rank:216,name:"Lambach",bundesland:"Oberösterreich",population:3856,website:"https://www.lambach.at"},
  {rank:217,name:"Steindorf am Ossiacher See",bundesland:"Kärnten",population:3850,website:"http://www.steindorf.gv.at"},
  {rank:218,name:"Grünburg",bundesland:"Oberösterreich",population:3840,website:"http://www.gruenburg.at"},
  {rank:219,name:"Kirchberg am Wagram",bundesland:"Niederösterreich",population:3830,website:"https://www.kirchberg-am-wagram.at"},
  {rank:220,name:"Gföhl",bundesland:"Niederösterreich",population:3814,website:"http://www.gfoehl.gv.at"},
  {rank:221,name:"Sankt Stefan im Rosental",bundesland:"Steiermark",population:3788,website:"http://www.rosental.at"},
  {rank:222,name:"Obdach",bundesland:"Steiermark",population:3783,website:"https://www.obdach.gv.at"},
  {rank:223,name:"Ilz",bundesland:"Steiermark",population:3778,website:"http://www.ilz.gv.at"},
  {rank:224,name:"Hausmannstätten",bundesland:"Steiermark",population:3777,website:"http://www.hausmannstaetten.gv.at"},
  {rank:225,name:"Dobl-Zwaring",bundesland:"Steiermark",population:3767,website:"http://www.dobl-zwaring.gv.at"},
  {rank:226,name:"Heidenreichstein",bundesland:"Niederösterreich",population:3735,website:"http://www.heidenreichstein.gv.at"},
  {rank:227,name:"Kittsee",bundesland:"Burgenland",population:3727,website:"http://www.kittsee.at"},
  {rank:228,name:"Haidershofen",bundesland:"Niederösterreich",population:3710,website:"http://www.haidershofen.gv.at"},
  {rank:229,name:"Strobl",bundesland:"Salzburg",population:3690,website:"http://www.gemeinde-strobl.at"},
  {rank:230,name:"Gramatneusiedl",bundesland:"Niederösterreich",population:3677,website:"http://www.gramatneusiedl.gv.at"},
  {rank:231,name:"Sonntagberg",bundesland:"Niederösterreich",population:3674,website:"http://www.sonntagberg.gv.at"},
  {rank:232,name:"Lannach",bundesland:"Steiermark",population:3668,website:"http://www.lannach.gv.at"},
  {rank:233,name:"Zams",bundesland:"Tirol",population:3642,website:"http://www.zams.gv.at"},
  {rank:234,name:"Molln",bundesland:"Oberösterreich",population:3640,website:"http://www.molln.at"},
  {rank:235,name:"Seefeld in Tirol",bundesland:"Tirol",population:3639,website:"http://www.seefeld-tirol.at"},
  {rank:236,name:"Neufeld an der Leitha",bundesland:"Burgenland",population:3621,website:"https://www.neufeld.at"},
  {rank:237,name:"Ardagger",bundesland:"Niederösterreich",population:3620,website:"http://www.ardagger.gv.at"},
  {rank:238,name:"Münster",bundesland:"Tirol",population:3604,website:"https://www.muenster.at"},
  {rank:239,name:"Enzersdorf an der Fischa",bundesland:"Niederösterreich",population:3601,website:"http://www.enzersdorf-fischa.gv.at"},
  {rank:240,name:"Großpetersdorf",bundesland:"Burgenland",population:3598,website:"http://www.grosspetersdorf.at"},
  {rank:241,name:"Pyhra",bundesland:"Niederösterreich",population:3593,website:"http://www.pyhra.gv.at"},
  {rank:242,name:"Güssing",bundesland:"Burgenland",population:3590,website:"http://www.guessing.co.at"},
  {rank:243,name:"Sankt Michael im Lungau",bundesland:"Salzburg",population:3573,website:"https://www.sankt-michael.at"},
  {rank:244,name:"Matrei am Brenner",bundesland:"Tirol",population:3556,website:"http://www.matrei-brenner.tirol.gv.at"},
  {rank:245,name:"Leutschach an der Weinstraße",bundesland:"Steiermark",population:3536,website:"http://www.leutschach-weinstrasse.gv.at"},
  {rank:246,name:"Kronstorf",bundesland:"Oberösterreich",population:3528,website:"http://www.kronstorf.at"},
  {rank:247,name:"Bad Fischau-Brunn",bundesland:"Niederösterreich",population:3525,website:"https://www.bad-fischau-brunn.gv.at"},
  {rank:248,name:"Eben am Achensee",bundesland:"Tirol",population:3518,website:"https://www.eben.at"},
];

const PATHS = [
  '/veranstaltungen', '/termine', '/events',
  '/aktuelles/veranstaltungen', '/buergerservice/aktuelles/veranstaltungen',
  '/freizeit/veranstaltungen', '/kultur/veranstaltungen',
  '/freizeit-tourismus/veranstaltungen', '/tourismus/veranstaltungen',
  '/aktuelles/termine', '/buergerservice/termine',
  '/veranstaltungskalender', '/kalender', '/event', '/programm'
];

const EVENT_KEYWORDS = [
  'veranstaltung', 'veranstaltungen', 'event', 'events', 'termine',
  'konzert', 'fest', 'feier', 'workshop', 'vortrag', 'ausstellung',
  'theater', 'kabarett', 'lesung', 'markt', 'flohmarkt',
  'wanderung', 'ball', 'kirtag', 'sommerfest', 'weihnacht',
  'fasching', 'ostermarkt', 'adventmarkt', 'volksmusik'
];

const DATE_PATTERNS = [
  /\d{1,2}\.\d{1,2}\.\d{2,4}/g,
  /\d{1,2}\.\s*(Jänner|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*\d{2,4}/gi,
  /\d{4}-\d{2}-\d{2}/g,
  /\d{1,2}\.\d{1,2}\.\s*-\s*\d{1,2}\.\d{1,2}\.\d{2,4}/g,
];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, timeout);

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-AT,de;q=0.9,en;q=0.5',
      },
      signal: controller.signal,
    };

    const req = mod.get(url, options, (res) => {
      // Follow redirects (up to 3)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        clearTimeout(timer);
        let loc = res.headers.location;
        if (loc.startsWith('/')) {
          const u = new URL(url);
          loc = u.origin + loc;
        }
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

function countDates(html) {
  let count = 0;
  for (const pat of DATE_PATTERNS) {
    const m = html.match(pat);
    if (m) count += m.length;
  }
  return count;
}

function countKeywords(html) {
  const lower = html.toLowerCase();
  let count = 0;
  for (const kw of EVENT_KEYWORDS) {
    const re = new RegExp(kw, 'gi');
    const m = lower.match(re);
    if (m) count += m.length;
  }
  return count;
}

function scoreResult(dateCount, keywordCount) {
  return dateCount * 2 + keywordCount;
}

function extractEventLinks(html) {
  const linkRe = /href=["']([^"']*?)["']/gi;
  const eventTerms = ['veranstaltung', 'termine', 'event', 'kalender', 'programm', 'freizeit', 'kultur', 'aktuelles'];
  const links = [];
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].toLowerCase();
    if (eventTerms.some(t => href.includes(t))) {
      links.push(m[1]);
    }
  }
  return [...new Set(links)];
}

function normalizeBase(website) {
  let base = website.replace(/\/+$/, '');
  // Ensure https
  if (base.startsWith('http://')) {
    base = 'https://' + base.slice(7);
  }
  return base;
}

async function probeGemeinde(g) {
  const base = normalizeBase(g.website);
  let bestResult = null;
  let bestScore = 0;

  // Phase 1: try standard paths
  for (const path of PATHS) {
    const url = base + path;
    try {
      const html = await fetchUrl(url);
      const dc = countDates(html);
      const kc = countKeywords(html);
      const score = scoreResult(dc, kc);
      if (score > bestScore) {
        bestScore = score;
        bestResult = { eventPageUrl: url, eventPagePath: path, dateCount: dc, keywordCount: kc, method: 'direct-path' };
      }
    } catch {}
    await delay(100);
  }

  if (bestScore >= 10) {
    return { ...g, ...bestResult };
  }

  // Phase 2: check homepage for event links
  try {
    const homeHtml = await fetchUrl(base + '/');
    const eventLinks = extractEventLinks(homeHtml);

    for (const link of eventLinks.slice(0, 5)) {
      let fullUrl;
      if (link.startsWith('http')) {
        fullUrl = link;
      } else if (link.startsWith('/')) {
        fullUrl = base + link;
      } else {
        fullUrl = base + '/' + link;
      }

      try {
        const html = await fetchUrl(fullUrl);
        const dc = countDates(html);
        const kc = countKeywords(html);
        const score = scoreResult(dc, kc);
        if (score > bestScore) {
          bestScore = score;
          const parsedPath = new URL(fullUrl).pathname;
          bestResult = { eventPageUrl: fullUrl, eventPagePath: parsedPath, dateCount: dc, keywordCount: kc, method: 'homepage-link' };
        }
      } catch {}
      await delay(100);
    }

    // If still nothing good, check homepage itself
    if (bestScore < 5) {
      const dc = countDates(homeHtml);
      const kc = countKeywords(homeHtml);
      const score = scoreResult(dc, kc);
      if (score > bestScore) {
        bestScore = score;
        bestResult = { eventPageUrl: base + '/', eventPagePath: '/', dateCount: dc, keywordCount: kc, method: 'homepage-content' };
      }
    }
  } catch {}

  if (bestResult) {
    return { ...g, ...bestResult };
  }

  return {
    ...g,
    eventPageUrl: null,
    eventPagePath: null,
    dateCount: 0,
    keywordCount: 0,
    method: 'none-found',
  };
}

async function main() {
  const results = [];
  console.log(`Probing ${gemeinden.length} municipalities (batch 4, rows 187-248)...`);

  for (let i = 0; i < gemeinden.length; i++) {
    const g = gemeinden[i];
    try {
      const result = await probeGemeinde(g);
      results.push(result);
      if (result.method !== 'none-found') {
        console.log(`  [${i+1}/${gemeinden.length}] ${g.name}: ${result.method} -> ${result.eventPagePath} (dates:${result.dateCount}, kw:${result.keywordCount})`);
      } else {
        console.log(`  [${i+1}/${gemeinden.length}] ${g.name}: no event page found`);
      }
    } catch (e) {
      console.log(`  [${i+1}/${gemeinden.length}] ${g.name}: ERROR ${e.message}`);
      results.push({
        ...g,
        eventPageUrl: null,
        eventPagePath: null,
        dateCount: 0,
        keywordCount: 0,
        method: 'error',
        error: e.message,
      });
    }

    if ((i + 1) % 10 === 0) {
      console.log(`--- Progress: ${i + 1}/${gemeinden.length} done ---`);
    }

    await delay(500);
  }

  // Remove rank from output, add clean fields
  const output = results.map(r => ({
    name: r.name,
    bundesland: r.bundesland,
    population: r.population,
    website: r.website,
    eventPageUrl: r.eventPageUrl,
    eventPagePath: r.eventPagePath,
    dateCount: r.dateCount,
    keywordCount: r.keywordCount,
    method: r.method,
  }));

  fs.writeFileSync('data/probe-batch4.json', JSON.stringify(output, null, 2));

  const found = results.filter(r => r.method !== 'none-found' && r.method !== 'error');
  const good = results.filter(r => r.dateCount >= 3);
  console.log(`\nDone! ${found.length}/${gemeinden.length} found event pages, ${good.length} with 3+ dates.`);
  console.log('Saved to data/probe-batch4.json');
}

main();
