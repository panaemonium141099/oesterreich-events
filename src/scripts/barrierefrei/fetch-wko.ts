/**
 * Quelle: Fachverband der Seilbahnen (wko.at) — "Barrierefreie Bergwelt":
 * je Bergbahn ein Datenblatt "Auf einen Blick" (PDF) mit barrierefreien
 * Parkplaetzen, Toiletten, Restaurants, mit Rollstuhl befahrbaren
 * Liftanlagen/Wegen/Attraktionen und Monoski-Anlagen (Stand Nov. 2024).
 *
 *   npx tsx src/scripts/barrierefrei/fetch-wko.ts
 *   -> data/barrierefrei/wko-at.json
 *
 * Braucht `pdftotext` (poppler) im PATH: die Datenblaetter sind Formulare,
 * `-layout` haelt die Spalten "Anzahl | Name" zusammen. Ort/PLZ der
 * Talstation stehen nicht im PDF und kommen aus der Tabelle TOWNS unten
 * (Talstation laut Datenblatt bzw. Website der Bahn).
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as cheerio from 'cheerio';
import type { DatasetEntry } from '@/lib/activities/barrierefrei-dataset';
import type { AccessibilityFeature } from '@/lib/activities/accessibility';
import { USER_AGENT, clean, dedupeEntries, fetchText, sleep, slugId, today, writeDataset } from './lib';

const LIST_URL = 'https://www.wko.at/oe/transport-verkehr/seilbahnen/barrierefreie-bergwelt';
const SOURCE = 'wko-at';

/** Anzeige-Name, Ort und PLZ der Talstation je Datenblatt (Schluessel = PDF-Dateiname). */
const TOWNS: Record<string, { name: string; town: string; postal_code: string; address?: string }> = {
  'barrierefreie-bergwelt-hochficht-bergbahnen.pdf': { name: 'Hochficht Bergbahnen', town: 'Klaffer am Hochficht', postal_code: '4163', address: 'Talstation Hochficht' },
  'barrierefreie-bergwelt-kaprun.pdf': { name: 'Kitzsteinhorn und Maiskogel (Gletscherbahnen Kaprun)', town: 'Kaprun', postal_code: '5710', address: 'Talstation Gletscherjet 1' },
  'barrierefreie-bergwelt-grossarl.pdf': { name: 'Großarler Bergbahnen', town: 'Großarl', postal_code: '5611', address: 'Talstation Panoramabahn' },
  'barrierefreie-bergwelt-leogang.pdf': { name: 'Leoganger Bergbahnen', town: 'Leogang', postal_code: '5771', address: 'Talstation Asitzbahn' },
  'barrierefreie-bergwelt-zwoelferhorn.pdf': { name: 'Zwölferhorn Seilbahn', town: 'St. Gilgen', postal_code: '5340', address: 'Talstation Zwölferhorn Seilbahn' },
  'barrierefreie-bergwelt-loser-bergbahnen.pdf': { name: 'Loser Bergbahnen', town: 'Altaussee', postal_code: '8992', address: 'Talstation Loser' },
  'barrierefreie-bergwelt-reiteralm.pdf': { name: 'Reiteralm Bergbahnen', town: 'Schladming', postal_code: '8973', address: 'Talstation Reiteralm, Pichl' },
  'barrierefreie-bergwelt-kitzbuehel.pdf': { name: 'Bergbahn Kitzbühel (Hahnenkamm, Kitzbüheler Horn)', town: 'Kitzbühel', postal_code: '6370', address: 'Talstation Hahnenkammbahn' },
  'barrierefreie-bergwelt-brixen.pdf': { name: 'Bergbahn Brixen im Thale', town: 'Brixen im Thale', postal_code: '6364', address: 'Talstation Bergbahn Brixen' },
  'barrierefreie-bergwelt-bergbahnen-fieberbrunn.pdf': { name: 'Bergbahnen Fieberbrunn', town: 'Fieberbrunn', postal_code: '6391', address: 'Talstation Bergbahnen Fieberbrunn' },
  'barrierefreie-bergbahnen-hohe-salve-hopfgarten-itter.pdf': { name: 'Bergbahnen Hohe Salve Hopfgarten-Itter', town: 'Hopfgarten im Brixental', postal_code: '6361', address: 'Talstation Salvenbahn' },
  'barrierefreie-bergwelt-bergbahnen-steinplatte-waidring.pdf': { name: 'Bergbahnen Steinplatte Waidring', town: 'Waidring', postal_code: '6384', address: 'Talstation Steinplatte' },
  'barrierefreie-bergwelt-auf-einen-blick-westendorf.pdf': { name: 'Bergbahnen Westendorf', town: 'Westendorf', postal_code: '6363', address: 'Talstation Alpenrosenbahn' },
  'barrierefreie-bergwelt-wilder-kaiser.pdf': { name: 'Bergbahnen Wilder Kaiser (Söll, Scheffau, Ellmau, Going)', town: 'Söll', postal_code: '6306', address: 'Talstation Hochsöll' },
  'barrierefreie-bergwelt-ehrwalder-alm.pdf': { name: 'Ehrwalder Almbahn', town: 'Ehrwald', postal_code: '6632', address: 'Talstation Ehrwalder Almbahn' },
  'barrierefreie-bergwelt-fuegen-bergbahn.pdf': { name: 'Spieljochbahn Fügen', town: 'Fügen', postal_code: '6263', address: 'Talstation Spieljochbahn' },
  'barrierefreie-bergwelt-gerlospass-koenigsleiten.pdf': { name: 'Gerlospass Königsleiten Bergbahnen', town: 'Wald im Pinzgau', postal_code: '5742', address: 'Talstation Dorfbahn Königsleiten' },
  'barrierefreie-bergwelt-glungezerbahn.pdf': { name: 'Glungezerbahn', town: 'Tulfes', postal_code: '6075', address: 'Talstation Glungezerbahn' },
  'barrierefreie-bergwelt-karwendel-bergbahn.pdf': { name: 'Karwendel-Bergbahn Pertisau', town: 'Pertisau', postal_code: '6213', address: 'Talstation Karwendel-Bergbahn' },
  'barrierefreie-bergwelt-kellerjoch-schwaz.pdf': { name: 'Kellerjochbahn Schwaz', town: 'Schwaz', postal_code: '6130', address: 'Talstation Kellerjochbahn' },
  'barrierefreie-bergwelt-mayrhofner-bergbahnen.pdf': { name: 'Mayrhofner Bergbahnen (Penken, Ahorn)', town: 'Mayrhofen', postal_code: '6290', address: 'Talstation Penkenbahn' },
  'barrierefreie-bergwelt-patscherkofelbahn.pdf': { name: 'Patscherkofelbahn', town: 'Innsbruck', postal_code: '6080', address: 'Talstation Patscherkofelbahn, Igls' },
  'barrierefreie-bergwelt-reuttener-seilbahnen.pdf': { name: 'Reuttener Seilbahnen (Hahnenkamm)', town: 'Höfen', postal_code: '6604', address: 'Talstation Reuttener Seilbahnen' },
  'barrierefreie-bergwelt-schilift-zentrum-gerlos.pdf': { name: 'Zillertal Arena Gerlos (Schilift-Zentrum Gerlos)', town: 'Gerlos', postal_code: '6281', address: 'Talstation Isskogelbahn' },
  'barrierefreie-bergwelt-skiliftgesellschaft-hochfuegen.pdf': { name: 'Skiliftgesellschaft Hochfügen', town: 'Fügenberg', postal_code: '6264', address: 'Hochfügen' },
  'barrierefreie-bergwelt-komperdell.pdf': { name: 'Seilbahn Komperdell Serfaus', town: 'Serfaus', postal_code: '6534', address: 'Talstation Komperdellbahn' },
  'barrierefreie-bergwelt-zugspitzbahn.pdf': { name: 'Tiroler Zugspitzbahn', town: 'Ehrwald', postal_code: '6632', address: 'Talstation Tiroler Zugspitzbahn, Obermoos' },
  'barrierefreie-bergwelt-stubaier-gletscher.pdf': { name: 'Stubaier Gletscher', town: 'Neustift im Stubaital', postal_code: '6167', address: 'Talstation Mutterberg' },
  'barrierefreie-bergwelt-bergbahn-buchensteinwand-pillersee.pdf': { name: 'Bergbahn Buchensteinwand Pillersee', town: 'St. Jakob in Haus', postal_code: '6392', address: 'Talstation Buchensteinwand' },
  'barrierefreie-bergwelt-finkenberger-almbahnen.pdf': { name: 'Finkenberger Almbahnen', town: 'Finkenberg', postal_code: '6292', address: 'Talstation Finkenberger Almbahn' },
  'barrierefreie-bergwelt-zeller-bergbahnen-zillertal.pdf': { name: 'Zeller Bergbahnen (Zillertal Arena Zell am Ziller)', town: 'Zell am Ziller', postal_code: '6280', address: 'Talstation Rosenalmbahn' },
  'barrierefreie-bergwelt-zillertaler-gletscherbahn.pdf': { name: 'Hintertuxer Gletscher (Zillertaler Gletscherbahn)', town: 'Tux', postal_code: '6294', address: 'Talstation Gletscherbus 1, Hintertux' },
  'barrierefreie-bergwelt-oberstorf-kleinwalsertall.pdf': { name: 'Oberstdorf Kleinwalsertal Bergbahnen', town: 'Riezlern', postal_code: '6991', address: 'Talstation Kanzelwandbahn' },
  'barrierefreie-bergwelt-pfaender.pdf': { name: 'Pfänderbahn Bregenz', town: 'Bregenz', postal_code: '6900', address: 'Talstation Pfänderbahn, Steinbruchgasse 4' },
  'barrierefreie-bergwelt-seilbahn-bezau.pdf': { name: 'Seilbahn Bezau', town: 'Bezau', postal_code: '6870', address: 'Talstation Seilbahn Bezau' },
  'barrierefreie-bergwelt-silvretta-montafon.pdf': { name: 'Silvretta Montafon', town: 'Schruns', postal_code: '6780', address: 'Talstation Hochjochbahn' },
};

interface Block {
  count: number | null;
  items: string[];
}

/**
 * Zwei Datenblaetter sind eingescannt (nur Bild) — Abschrift der Formulare
 * (Stand November 2024), Schluessel = PDF-Dateiname.
 */
const SCANNED: Record<string, string> = {
  'barrierefreie-bergwelt-zwoelferhorn.pdf': `Bergbahnunternehmen
Zwölferhorn-Seilbahn Ges.m.b.H
Höchster Punkt, der barrierefrei erreicht werden kann: ...... m
1500m
Barrierefreie Parkplätze
Anzahl Name Parkplatz/Talstation
3 Talstation Zwölferhorn-Seilbahn
Barrierefreien Toiletten
Anzahl Örtlichkeit
2 Talstation und Bergstation Zwölferhorn-Seilbahn
Barrierefreien Restaurants
Anzahl Name
1 Das Zwölfer - Bistro
Winter am Berg
Mit Monoski befahrbaren/barrierefreien Liftanlagen
Anzahl Name der Bahn
Mit Monoski befahrbare Pisten
Anzahl
Mit Rollstuhl befahrbare Attraktionen
Anzahl Beschreibung
Idealer „barrierefreier“ Einstiegspunkt ins Skigebiet
Name der Talstation / Beschreibung
Sommer am Berg
mit Rollstuhl befahrbaren/barrierefreien Liftanlagen
Anzahl Name / Name der Talstation
1 Zwölferhorn-Seilbahn
Mit Rollstuhl befahrbare Wege
Anzahl Beschreibung
1 mit Begleitung - Pillstein Rundwanderweg
Mit Rollstuhl befahrbare Attraktionen
Anzahl Beschreibung
Idealer „barrierefreier“ Einstiegspunkt in die Sommerbergwelt
Name der Talstation / Beschreibung
Zwölferhorn-Seilbahn
Link Website
www.zwoelferhorn.at
`,
  'barrierefreie-bergwelt-bergbahn-buchensteinwand-pillersee.pdf': `Bergbahnunternehmen
Bergbahn Buchensteinwand Pillersee GmbH
Höchster Punkt, der barrierefrei erreicht werden kann: ...... m
1450 m
Barrierefreie Parkplätze
Anzahl Name Parkplatz/Talstation
4SBK Buchensteinwand
Barrierefreien Toiletten
Anzahl Örtlichkeit
1 Talstation St. Ulrich am Pillersee / alle WCs barrierefrei zugänglich (kein barrierefreies WC vorhanden)
Barrierefreien Restaurants
Anzahl Name
1 Das Bergblick
Winter am Berg
Mit Monoski befahrbaren/barrierefreien Liftanlagen
Anzahl Name der Bahn
2 4SBK Buchensteinwand
4CLF Panoramabahn
Mit Monoski befahrbare Pisten
Anzahl
4
Mit Rollstuhl befahrbare Attraktionen
Anzahl Beschreibung
- -
Idealer „barrierefreier“ Einstiegspunkt ins Skigebiet
Name der Talstation / Beschreibung
4SBK Buchensteinwand
Sommer am Berg
mit Rollstuhl befahrbaren/barrierefreien Liftanlagen
Anzahl Name / Name der Talstation
1 4SBK Buchensteinwand
Mit Rollstuhl befahrbare Wege
Anzahl Beschreibung
1 Weg von der Bergstation der 4SBK Buchensteinwand zum Jakobskreuz mit dem Rollstuhl befahrbar
Mit Rollstuhl befahrbare Attraktionen
Anzahl Beschreibung
1 Das Jakobskreuz
Idealer „barrierefreier“ Einstiegspunkt in die Sommerbergwelt
Name der Talstation / Beschreibung
4SBK Buchensteinwand
Link Website
www.bergbahn-pillersee.com
`,
};

/** Abschnitt zwischen zwei Ueberschriften: erste Zahl = Anzahl, Rest = Namen. */
function block(text: string, from: RegExp, to: RegExp): Block {
  const start = from.exec(text);
  if (!start) return { count: null, items: [] };
  const rest = text.slice(start.index + start[0].length);
  const end = to.exec(rest);
  const body = end ? rest.slice(0, end.index) : rest;
  const lines = body
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l && !/^anzahl\b/i.test(l) && !/^name/i.test(l) && !/^örtlichkeit|^beschreibung$/i.test(l));
  let count: number | null = null;
  const items: string[] = [];
  for (const rawLine of lines) {
    // "-" bzw. "0  -" heisst: nichts vorhanden
    const line = rawLine.replace(/^[-–—]\s+/, '').replace(/^[-–—]$/, '');
    if (!line) continue;
    const m = /^(\d+)(?:\s+(.*))?$/.exec(line);
    if (m && count === null) {
      count = Number(m[1]);
      if (m[2] && !/^[-–—]$/.test(m[2].trim())) items.push(m[2]);
    } else if (/^\d+$/.test(line)) {
      // nachgestellte Zaehler ("1" unter der Liftliste) ignorieren
    } else {
      items.push(line);
    }
  }
  return { count, items: items.map((s) => s.replace(/\s*[,;]\s*$/, '')).filter(Boolean) };
}

function pdfText(pdfPath: string): string {
  return execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}

async function main(): Promise<void> {
  const html = await fetchText(LIST_URL);
  const $ = cheerio.load(html);
  const pdfs: { name: string; url: string; state: string }[] = [];
  let state = '';
  $('h3, a[href$=".pdf"]').each((_, el) => {
    if (el.tagName === 'h3') {
      const m = /Seilbahnen in (?:der )?(.+)$/.exec(clean($(el).text()) ?? '');
      if (m) state = m[1];
      return;
    }
    const href = $(el).attr('href') ?? '';
    if (!/barrierefreie-berg/.test(href) || /auf-einen-blick\.pdf$/.test(href)) return;
    const name = clean($(el).text());
    if (!name) return;
    pdfs.push({ name, url: href.startsWith('http') ? href : `https://www.wko.at${href}`, state });
  });
  console.log(`[wko] ${pdfs.length} Datenblaetter`);

  const cache = join(tmpdir(), 'lasstreffen-wko');
  mkdirSync(cache, { recursive: true });
  const entries: DatasetEntry[] = [];

  for (const pdf of pdfs) {
    const file = pdf.url.split('/').pop() ?? '';
    const meta = TOWNS[file];
    if (!meta) {
      console.log(`[wko] ${file}: kein Ort hinterlegt, uebersprungen (${pdf.name})`);
      continue;
    }
    const local = join(cache, file);
    const res = await fetch(pdf.url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) {
      console.log(`[wko] ${file}: HTTP ${res.status}`);
      continue;
    }
    writeFileSync(local, Buffer.from(await res.arrayBuffer()));
    await sleep(200);
    const text = SCANNED[file] ?? pdfText(local);

    const company = clean(/Bergbahnunternehmen\s*\n\s*(.+)/.exec(text)?.[1]) ?? pdf.name;
    const highest = clean(/Höchster Punkt[^\n]*\n\s*(.+)/.exec(text)?.[1]);
    const parking = block(text, /Barrierefreie Parkplätze/, /Barrierefreien Toiletten/);
    const toilets = block(text, /Barrierefreien Toiletten/, /Barrierefreien Restaurants/);
    const restaurants = block(text, /Barrierefreien Restaurants/, /Winter am Berg/);
    const monoski = block(text, /Mit Monoski befahrbaren\/barrierefreien Liftanlagen/, /Mit Monoski befahrbare Pisten/);
    const summer = text.slice(text.search(/Sommer am Berg/));
    const lifts = block(summer, /mit Rollstuhl befahrbaren\/barrierefreien Liftanlagen/i, /Mit Rollstuhl befahrbare Wege/);
    const paths = block(summer, /Mit Rollstuhl befahrbare Wege/, /Mit Rollstuhl befahrbare Attraktionen/);
    const attractions = block(summer, /Mit Rollstuhl befahrbare Attraktionen/, /Idealer/);
    const entry = block(summer, /Idealer[^\n]*Sommerbergwelt/, /Link Website/);
    const websiteRaw = clean(/Link Website\s*\n\s*(\S+)/.exec(text)?.[1]);
    const website = websiteRaw && /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(websiteRaw) ? websiteRaw : null;

    const features = new Set<AccessibilityFeature>(['rollstuhl']);
    if ((parking.count ?? 0) > 0 || parking.items.length > 0) features.add('parkplatz');
    if ((toilets.count ?? 0) > 0 || toilets.items.length > 0) features.add('wc');
    const tags = ['bergtour', 'wandern'];
    if ((monoski.count ?? 0) > 0) tags.push('ski');

    const summerOffer = lifts.items.length + paths.items.length + attractions.items.length > 0;
    const parts: string[] = [];
    if (!summerOffer) parts.push('Laut Datenblatt im Sommer keine mit dem Rollstuhl befahrbaren Bahnen oder Wege gemeldet');
    if (highest) parts.push(`Höchster barrierefrei erreichbarer Punkt: ${highest.replace(/^Gipfelstation:\s*/i, '')}`);
    if (lifts.items.length) parts.push(`Mit dem Rollstuhl befahrbare Bahnen im Sommer: ${lifts.items.join('; ')}`);
    if (paths.items.length) parts.push(`Mit dem Rollstuhl befahrbare Wege: ${paths.items.join('; ')}`);
    if (attractions.items.length) parts.push(`Mit dem Rollstuhl befahrbare Attraktionen: ${attractions.items.join('; ')}`);
    if (entry.items.length) parts.push(`Idealer barrierefreier Einstieg: ${entry.items.join('; ')}`);
    if (restaurants.items.length || (restaurants.count ?? 0) > 0) parts.push(`Barrierefreie Restaurants: ${restaurants.items.join('; ') || restaurants.count}`);
    if (toilets.items.length || (toilets.count ?? 0) > 0) parts.push(`Barrierefreie Toiletten: ${toilets.items.join('; ') || toilets.count}`);
    if (parking.items.length || (parking.count ?? 0) > 0) parts.push(`Barrierefreie Parkplätze: ${parking.items.join('; ') || parking.count}`);
    if ((monoski.count ?? 0) > 0) parts.push(`Winter: ${monoski.count} mit Monoski befahrbare Anlagen (${monoski.items.join('; ')})`);

    entries.push({
      id: slugId(file.replace(/\.pdf$/, '').replace(/^barrierefreie-berg(?:welt|bahnen)-/, '')),
      name: meta.name,
      description: `${company} (${pdf.state}): barrierefreie Bergwelt laut Datenblatt des Fachverbands der Seilbahnen. ${parts.join('. ')}.`,
      tags,
      setting: 'outdoor',
      address: meta.address ?? null,
      postal_code: meta.postal_code,
      town: meta.town,
      website: website ? (website.startsWith('http') ? website : `https://${website}`) : null,
      source_url: pdf.url,
      accessibility: {
        features: [...features],
        note: `Laut WKO-Datenblatt „Barrierefreie Bergwelt auf einen Blick“ (Stand November 2024): ${parts.slice(0, 4).join('. ')}.`,
      },
      images: [],
    });
    console.log(`[wko] + ${meta.name}: Lifte ${lifts.count ?? '?'}, Wege ${paths.count ?? '?'}, WC ${toilets.count ?? '?'}, P ${parking.count ?? '?'}`);
  }

  writeDataset({
    source: SOURCE,
    source_label: 'Fachverband der Seilbahnen, WKO (wko.at)',
    source_url: LIST_URL,
    checked_at: today(),
    entries: dedupeEntries(entries),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
