import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadGemeindenDe } from '@/lib/gemeinden/de';
import { buildRegistry, diffRegistry, eventPageUrl, type ErhebungRow, type RegistryEntryDe } from '@/lib/registry-de/build';
import { calendarPageCandidates, feedFormat, feedUrlFromPage, looksLikeFeed } from '@/lib/registry-de/feed-url';
import { INTEGRATIONS, stufeOf } from '@/lib/registry-de/integrations';
import { robotsAllows } from '@/lib/registry-de/robots';

describe('Feed-URL aus der Kalenderseite', () => {
  it('ionas: data-source des TVM-Kalenders (Muster amt-sn.de)', () => {
    const html = '<div class="tvm-picker" data-source="https://www.amt-sn.de/kalender/events.json?weekends=false&amp;tagMode=ALL"></div>';
    expect(feedUrlFromPage('ionas', html, 'https://www.amt-sn.de/kalender/')).toBe('https://www.amt-sn.de/kalender/events.json?weekends=false&tagMode=ALL');
    expect(feedUrlFromPage('ionas', '<div class="component-sourceCode"></div>', 'https://www.grosshansdorf.de/x')).toBeNull();
  });

  it('Cross7: genau eine data-c7-page → öffentliche API', () => {
    const html = '<script src="https://components.cross-7.de/v2/components.esm.js" data-c7-env="production" data-c7-page="784"></script>';
    expect(feedUrlFromPage('cross7', html, 'https://www.meitingen.de/v')).toBe('https://api.cross-7.de/public/calendar/784/events');
    expect(feedUrlFromPage('cross7', html + '<x data-c7-page="785">', 'https://www.meitingen.de/v')).toBeNull();
  });

  it('NOLIS: Link „vCalendar exportieren"', () => {
    const html = '<a href="/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&amp;selected_kommune=21890&amp;beginn=x">vCalendar exportieren</a>';
    expect(feedUrlFromPage('nolis', html, 'https://www.bruchhausen-vilsen.de/regional/veranstaltungen/sucheplus.html'))
      .toBe('https://www.bruchhausen-vilsen.de/veranstaltungen/veranstaltungen.ical?zeitauswahl=1&selected_kommune=21890&beginn=x');
  });

  it('Komm.ONE: RSS-Pfad aus Detail-Links der Liste (Dauchingen, unverlinkt)', () => {
    const html = '<a href="/site/Dauchingen-2022/node/19702868/zmdetail_523255171427/Weihnachtsmarkt.html?nodeID=1">x</a>';
    expect(feedUrlFromPage('komm1', html, 'https://www.dauchingen.de/19702868')).toBe('https://www.dauchingen.de/site/Dauchingen-2022/zmrss/19702868/rss.xml');
  });

  it('The Events Calendar: fester REST-Pfad nur mit Plugin-Merkmal', () => {
    expect(feedUrlFromPage('tribe', '<link rel="stylesheet" href="/wp-content/plugins/the-events-calendar/x.css">', 'https://plaidt.de/veranstaltungen'))
      .toBe('https://plaidt.de/wp-json/tribe/events/v1/events');
    expect(feedUrlFromPage('tribe', '<p>Termine</p>', 'https://plaidt.de/veranstaltungen')).toBeNull();
  });

  it('JEvents und iCagenda: Feed-Link im Kopf', () => {
    const j = '<link href="/index.php?option=com_jevents&amp;task=modlatest.rss&amp;format=feed&amp;type=rss&amp;Itemid=5&amp;modid=0" rel="alternate" type="application/rss+xml">';
    expect(feedUrlFromPage('jevents', j, 'https://www.gemeinde-ahrbrueck.de/index.php/termine')).toContain('task=modlatest.rss');
    const ic = '<link rel="alternate" type="application/rss+xml" href="/leben-in-rhens/veranstaltungen?format=feed&amp;type=rss">';
    expect(feedUrlFromPage('icagenda', ic, 'https://www.rhens.de/leben-in-rhens/veranstaltungen')).toBe('https://www.rhens.de/leben-in-rhens/veranstaltungen?format=feed&type=rss');
  });

  it('JEvents mit RSS und Atom im Kopf: RSS (soennebuell.de)', () => {
    const html = '<link href="https://www.soennebuell.de/index.php?option=com_jevents&amp;task=modlatest.rss&amp;format=feed&amp;type=rss&amp;Itemid=135&amp;modid=0" rel="alternate" type="application/rss+xml" title="RSS 2.0">'
      + '<link href="https://www.soennebuell.de/index.php?option=com_jevents&amp;task=modlatest.rss&amp;format=feed&amp;type=atom&amp;Itemid=135&amp;modid=0" rel="alternate" type="application/atom+xml" title="Atom 1.0">';
    expect(feedUrlFromPage('jevents', html, 'https://www.soennebuell.de/index.php/gemeinde/jahresterminplan')).toContain('type=rss');
  });

  it('communice: …/veranstaltungskalender/rss (Mitteldithmarschen)', () => {
    const html = '<a href="/tourismus-naherholung/touristinformation/veranstaltungskalender/rss" type="application/rss+xml">RSS</a>';
    expect(feedUrlFromPage('communice', html, 'https://www.mitteldithmarschen.de/tourismus-naherholung/touristinformation/veranstaltungskalender'))
      .toBe('https://www.mitteldithmarschen.de/tourismus-naherholung/touristinformation/veranstaltungskalender/rss');
  });

  it('Standardseiten je Hersteller und Formatprüfung des Abrufs', () => {
    expect(calendarPageCandidates('nolis', 'https://www.barsbuettel.de')).toEqual(['https://www.barsbuettel.de/regional/veranstaltungen/sucheplus.html']);
    expect(calendarPageCandidates('tribe', 'https://x.de')).toEqual([]);
    expect(looksLikeFeed('ics', 'BEGIN:VCALENDAR\r\nVERSION:2.0')).toBe(true);
    expect(looksLikeFeed('ics', '<!DOCTYPE html><html>')).toBe(false);
    expect(looksLikeFeed('xml', '<?xml version="1.0"?>\n<rss version="2.0">')).toBe(true);
    expect(looksLikeFeed('xml', '<html><body>404</body></html>')).toBe(false);
    expect(looksLikeFeed('json', '[{"id":"1:0","title":"Kerb"}]')).toBe(true);
    expect(looksLikeFeed('json', '{"events":[],"total":0}')).toBe(true);
    expect(looksLikeFeed('json', '<html>')).toBe(false);
    expect(feedFormat('ionas')).toBe('json');
    expect(feedFormat('verwaltungsportal')).toBeNull();
  });

  it('unbekannte oder HTML-Integration: kein Feed', () => {
    expect(feedUrlFromPage('verwaltungsportal', '<a href="/rss.xml">', 'https://www.gedern.de/')).toBeNull();
  });
});

describe('robots.txt', () => {
  const txt = 'User-agent: AhrefsBot\nDisallow: /\n\nUser-agent: *\nDisallow: /output/\nAllow: /output/frei/\nCrawl-delay: 10\n';
  it('Gruppe *, längster Treffer gewinnt', () => {
    expect(robotsAllows(txt, 'https://www.pfatter.de/Freizeit/Veranstaltungskalender/', 'lasstreffen-registry')).toBe(true);
    expect(robotsAllows(txt, 'https://www.pfatter.de/output/options.php?ModID=11', 'lasstreffen-registry')).toBe(false);
    expect(robotsAllows(txt, 'https://www.pfatter.de/output/frei/x', 'lasstreffen-registry')).toBe(true);
  });
  it('fremde Bot-Gruppe gilt nicht für uns, eigene schon', () => {
    expect(robotsAllows('User-agent: lasstreffen\nDisallow: /\n', 'https://x.de/a', 'lasstreffen-registry')).toBe(false);
    expect(robotsAllows('User-agent: *\nDisallow: /*?*\n', 'https://meinort.de/welcome?ort=1', 'lasstreffen-registry')).toBe(false);
    expect(robotsAllows(null, 'https://x.de/a', 'lasstreffen-registry')).toBe(true);
  });
});

const row = (o: Partial<ErhebungRow>): ErhebungRow => ({
  ags: '07137088', name: 'Plaidt', host: 'plaidt.de', stufe: 'A', integration: 'tribe', vb_host: '', vb_integration: '',
  event_url: 'https://plaidt.de/veranstaltungen', vb_event_url: '', heimatinfo_id: '', meinort_ort: '', ...o,
});

describe('Registry-Aufbau', () => {
  const landByAgs = new Map([['07137088', 'rheinland-pfalz'], ['07143205', 'rheinland-pfalz'], ['09679152', 'bayern']]);
  it('Feed nur aus dem Feed-Lauf, Ausweichwege aus der Erhebung', () => {
    const { entries, problems } = buildRegistry({
      rows: [
        row({}),
        row({ ags: '07143205', name: 'Atzelgift', host: 'atzelgift.de', stufe: 'M', integration: 'kein_link', event_url: '', meinort_ort: '1936-Atzelgift' }),
        row({ ags: '09679152', name: 'Leinach', host: 'leinach.de', stufe: 'A', integration: 'heimatinfo', heimatinfo_id: '692a3da4-2425-476e-957b-cc2aa5e0269f' }),
      ],
      landByAgs,
      feeds: new Map([['https://plaidt.de/veranstaltungen', 'https://plaidt.de/wp-json/tribe/events/v1/events']]),
      checkedAt: '2026-10-28',
    });
    expect(problems).toEqual([]);
    expect(entries.find(e => e.ags === '07137088')?.feed_url).toBe('https://plaidt.de/wp-json/tribe/events/v1/events');
    expect(entries.find(e => e.ags === '07143205')?.fallback).toEqual({ kind: 'meinort', ort: '1936-Atzelgift' });
    expect(entries.find(e => e.ags === '09679152')?.feed_url).toBe('https://heimatinfo-api-platform.azurewebsites.net/communes/692a3da4-2425-476e-957b-cc2aa5e0269f/events');
  });

  it('meldet Gemeinde ohne Stammdaten, Doppelte und unbekannte Integration', () => {
    const { problems } = buildRegistry({
      rows: [row({}), row({}), row({ ags: '99999999' }), row({ ags: '09679152', integration: 'erfunden' })],
      landByAgs, feeds: new Map(), checkedAt: 'x',
    });
    expect(problems).toHaveLength(3);
  });

  it('Terminbuchung und Abfallkalender sind keine Kalender-URL', () => {
    expect(eventPageUrl('https://www.terminland.de/sg-hage/')).toBeNull();
    expect(eventPageUrl('https://termine-reservieren.de/termine/gronau/')).toBeNull();
    expect(eventPageUrl('https://kuddewoerde.orts.app/veranstaltungen/')).toBe('https://kuddewoerde.orts.app/veranstaltungen/');
  });

  it('Diff ohne checked_at', () => {
    const a = buildRegistry({ rows: [row({})], landByAgs, feeds: new Map(), checkedAt: '1' }).entries;
    const b = buildRegistry({ rows: [row({ integration: 'mec' })], landByAgs, feeds: new Map(), checkedAt: '2' }).entries;
    expect(diffRegistry(a, a.map(e => ({ ...e, checked_at: 'z' })))).toEqual({ added: [], removed: [], changed: [] });
    expect(diffRegistry(a, b).changed).toEqual([{ ags: '07137088', fields: ['integration'] }]);
  });
});

describe('Wächter: data/de-gemeinde-registry.json', () => {
  const file = join(process.cwd(), 'data', 'de-gemeinde-registry.json');
  const reg = (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []) as RegistryEntryDe[];
  const gemeinden = loadGemeindenDe();

  it('je Gemeinde der Stammdaten genau ein Eintrag', () => {
    expect(reg.length).toBe(gemeinden.length);
    expect(new Set(reg.map(e => e.ags)).size).toBe(reg.length);
    const byAgs = new Map(gemeinden.map(g => [g.ags, g]));
    expect(reg.filter(e => byAgs.get(e.ags)?.land !== e.land).map(e => e.ags)).toEqual([]);
  });

  it('nur bekannte Integrationen, Stufe passt, Feeds nur in Stufe A', () => {
    const bad = reg.filter(e =>
      !(e.integration in INTEGRATIONS) ||
      ('ABCDE'.includes(stufeOf(e.integration)!) && e.stufe !== stufeOf(e.integration)) ||
      (e.feed_url && stufeOf(e.integration) !== 'A') ||
      (e.fallback?.kind === 'verband' && !(e.fallback.integration in INTEGRATIONS)),
    );
    expect(bad.map(e => `${e.ags} ${e.integration}`)).toEqual([]);
  });

  it('keine Kalender-URL auf Terminbuchung oder Abfallkalender', () => {
    const bad = reg.filter(e => [e.url, e.fallback?.kind === 'verband' ? e.fallback.url : null].some(u => u && eventPageUrl(u) === null));
    expect(bad.map(e => `${e.ags} ${e.url}`)).toEqual([]);
  });

  it('Ausweichweg nur, wo die eigene Website keinen Kalender hat', () => {
    expect(reg.filter(e => e.fallback && 'ABCDE'.includes(e.stufe)).map(e => e.ags)).toEqual([]);
    expect(reg.filter(e => (e.stufe === 'V' || e.stufe === 'M') && !e.fallback).map(e => e.ags)).toEqual([]);
  });
});
