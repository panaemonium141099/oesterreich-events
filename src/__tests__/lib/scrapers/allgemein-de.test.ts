/**
 * DE-Adapter allgemeiner Parser (fn-29.16), Golden-Tests auf echten
 * Kalenderseiten (abgerufen 2026-10-29, gekürzt um Skripte und Stile):
 * Tröndel (Liste mit „Uhrzeit:", Gemeinde-Dienst, Termin im Nachbarort),
 * Kellinghusen (ganztägig, Detailseiten), Ornbau (Datum in der Überschrift),
 * Kamern (JSON-LD), Contwig (Tabelle mit Kopf), Amt am Stettiner Haff
 * (Amtskalender), Kempen (Spanne), Hamminkeln (Beschriftung vor dem Datum),
 * Schlöben (Name im Beitragskopf).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetHostGate } from '@/lib/scrapers/de/host-gate';
import { parseAllgemeinPage, recordTime, allgemeinSourceId, type AllgemeinTermin } from '@/lib/scrapers/de/allgemein';
import { findDateExprs } from '@/lib/scrapers/de/datum';
import { AllgemeinDeScraper, allgemeinGroups, allgemeinSeite, isStartseite, istKalender } from '@/lib/scrapers/de/AllgemeinDeScraper';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import { loadRegistryDe, type FeedGroup } from '@/lib/registry-de/load';

const TODAY = '2026-10-29';

// Der Freigabevertrag misst gegen die Uhr (start_in_past); sie steht deshalb auf
// dem Abrufdatum der Fixtures, sonst kippen die Zeilen mit jedem Tag.
beforeAll(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-29T12:00:00Z') }));
afterAll(() => vi.useRealTimers());

function page(name: string): { html: string; url: string } {
  const html = readFileSync(join(__dirname, 'fixtures', 'de-allgemein', `${name}.html`), 'utf8');
  return { html, url: /<!-- (\S+)/.exec(html)![1] };
}

function termine(name: string): AllgemeinTermin[] {
  const { html, url } = page(name);
  return parseAllgemeinPage(html, url, TODAY);
}

const byTitle = (list: AllgemeinTermin[], title: string) => {
  const t = list.find(x => x.title === title);
  if (!t) throw new Error(`kein Termin „${title}": ${list.map(x => x.title).join(' | ')}`);
  return t;
};

function groupFor(url: string): FeedGroup {
  const g = allgemeinGroups().find(x => x.feedUrl === url);
  if (!g) throw new Error(`keine Gruppe für ${url}`);
  return g;
}

type Row = {
  title: string; start_date: string; publish_status: string; latitude: number | null;
  location_resolution: { gemeinde: { name: string } | null; admission?: { reasons: string[] } };
};
const row = (t: AllgemeinTermin, url: string) =>
  toSupabaseRow(new AllgemeinDeScraper().toScraped(t, groupFor(url)), new Map(), new Map()).row as unknown as Row;

describe('Datumsangaben', () => {
  it('Zahl, Monatsname, zweistelliges Jahr', () => {
    expect(findDateExprs('Sa, 07.11.2026')).toMatchObject([{ start: '2026-11-07' }]);
    expect(findDateExprs('5. November 2026')).toMatchObject([{ start: '2026-11-05' }]);
    expect(findDateExprs('07.11.26 19 Uhr')).toMatchObject([{ start: '2026-11-07' }]);
  });

  it('Spannen: Anfang ohne Jahr nimmt Monat und Jahr vom Ende', () => {
    expect(findDateExprs('12.–14.12.2026')).toMatchObject([{ start: '2026-12-12', end: '2026-12-14' }]);
    expect(findDateExprs('Fr, 12.12. – So, 14.12.2026')).toMatchObject([{ start: '2026-12-12', end: '2026-12-14' }]);
    expect(findDateExprs('12. bis 14. Dezember 2026')).toMatchObject([{ start: '2026-12-12', end: '2026-12-14' }]);
    expect(findDateExprs('28.12. - 03.01.2027')).toMatchObject([{ start: '2026-12-28', end: '2027-01-03' }]);
    // Kempen: Anfang ohne Schlusspunkt
    expect(findDateExprs('16.10 - 05.11.2026')).toMatchObject([{ start: '2026-10-16', end: '2026-11-05' }]);
  });

  it('kein Datum: Uhrzeit mit Punkt, Datum ohne Jahr allein, unmöglicher Tag', () => {
    expect(findDateExprs('Beginn 19.30 Uhr')).toEqual([]);
    expect(findDateExprs('am 14.11.')).toEqual([]);
    expect(findDateExprs('31.02.2026')).toEqual([]);
  });

  it('Uhrzeit nach dem Datum, „19 Uhr", Spanne; mehrtägig ohne Uhrzeit', () => {
    const text = 'Kegeln Datum: 5. November 2026 Uhrzeit: 19:30 Ort: Gasthof';
    expect(recordTime(text, findDateExprs(text)[0])).toEqual({ start: '19:30' });
    const t2 = '07.11.26 19 Uhr Laternelaufen';
    expect(recordTime(t2, findDateExprs(t2)[0])).toEqual({ start: '19:00' });
    const t3 = '29.10.2026 15:00 - 17:00 Uhr Spiele';
    expect(recordTime(t3, findDateExprs(t3)[0])).toEqual({ start: '15:00', end: '17:00' });
    const t4 = 'Samstag, 31.10.2026 bis 01.11.2026 - 01:00 Uhr';
    expect(recordTime(t4, findDateExprs(t4)[0])).toBeNull();
  });
});

describe('Liste mit Datum', () => {
  it('Tröndel: Name aus der Überschrift, Uhrzeit aus „Uhrzeit:", Wandzeit Europe/Berlin', () => {
    const t = byTitle(termine('troendel'), 'Kegeln');
    expect(t).toMatchObject({ localDate: '2026-11-05', start: '2026-11-05T18:30:00.000Z', allDay: false, strategie: 'liste' });
  });

  it('Kellinghusen: ohne Uhrzeit ganztägig, Detailseite als Quelle', () => {
    const t = byTitle(termine('kellinghusen'), 'Halloween im Museum - Der letzte Ton');
    expect(t).toMatchObject({ start: '2026-10-31', allDay: true, url: 'https://www.kellinghusen.de/veranstaltungen/i4201/halloween-im-museum-der-letzte-ton' });
  });

  it('Ornbau: Datum und Uhrzeit vor dem Namen in derselben Überschrift gehören nicht zum Titel', () => {
    const list = termine('ornbau');
    expect(byTitle(list, 'Weinfahrt - FFW Ornbau')).toMatchObject({ start: '2026-11-07T14:00:00.000Z' });
    expect(list.every(t => !/^Uhr/.test(t.title))).toBe(true);
  });

  it('Contwig: die Spalte „Veranstaltung", nicht der Verein', () => {
    const list = termine('contwig');
    expect(list.map(t => t.title)).toContain('Sockenmarkt');
    expect(list.map(t => t.title)).not.toContain('Ev. Kirchengemeinde');
  });

  it('Kempen: Spanne „16.10 - 05.11.2026" beginnt am 16.10.', () => {
    const list = parseAllgemeinPage(page('kempen').html, page('kempen').url, '2026-10-16');
    const t = list.find(x => x.title.startsWith('Fackelausstellung'))!;
    expect(t).toMatchObject({ start: '2026-10-16', end: '2026-11-05' });
  });

  it('Hamminkeln: „Meldung vom: 29.10.2026" vor dem Namen fällt weg', () => {
    expect(termine('hamminkeln').map(t => t.title)).toContain('Sprachcafé Russisch');
  });

  it('Schlöben: Name im Kopf des Beitrags (article > header), nicht der verlinkte Ort', () => {
    const list = termine('schloeben');
    expect(list.map(t => t.title)).toContain('Jugendtreffpunkt im FIZ (Di)');
    expect(list.map(t => t.title)).not.toContain('Familienzentrum');
    expect(byTitle(list, 'Jugendtreffpunkt im FIZ (Di)')).toMatchObject({ start: '2026-11-03T15:00:00.000Z', end: '2026-11-03T18:00:00.000Z' });
  });

  it('kein Titel ist Datum oder Uhrzeit', () => {
    for (const name of ['troendel', 'kellinghusen', 'ornbau', 'contwig', 'kempen', 'hamminkeln', 'schloeben', 'stettiner-haff']) {
      for (const t of termine(name)) {
        expect(t.title, name).not.toMatch(/^\W*\d{1,2}[.:]\d{2}/);
        expect(findDateExprs(t.title).length === 0 || /\p{L}{3}/u.test(t.title), name).toBe(true);
      }
    }
  });
});

describe('JSON-LD', () => {
  it('Kamern: reines Datum ganztägig, Uhrzeit als deutsche Ortszeit, Ort aus location', () => {
    const list = termine('kamern');
    expect(list.every(t => t.strategie === 'jsonld')).toBe(true);
    expect(byTitle(list, 'Halloweenparty in Kamern')).toMatchObject({ start: '2026-10-30', allDay: true, locationName: 'Kamern, Jugendclub', postalCode: '39524', locality: 'Kamern' });
    expect(byTitle(list, 'Spieleabend Feuerwehr Kamern')).toMatchObject({ start: '2026-11-06T18:00:00.000Z' });
  });
});

describe('Ort und Gemeinde-Dienst', () => {
  it('Tröndel: eigener Termin bekommt die Gemeinde', () => {
    const t = byTitle(termine('troendel'), 'Dienstabend der Freiwilligen Feuerwehr');
    expect(row(t, page('troendel').url).location_resolution.gemeinde?.name).toBe('Tröndel');
  });

  it('Tröndel: Termin im Nachbarort (Ort: …, Krummbek) bekommt nicht Tröndel', () => {
    const t = byTitle(termine('troendel'), 'Kegeln');
    expect(t.placeText).toContain('Krummbek');
    const r = row(t, page('troendel').url);
    expect(r.location_resolution.gemeinde?.name).not.toBe('Tröndel');
  });

  it('Kellinghusen: Bürgermeistersprechstunde in Quarantäne municipal_service', () => {
    const t = byTitle(termine('kellinghusen'), 'Bürgermeistersprechstunde');
    const r = row(t, page('kellinghusen').url);
    expect(r.location_resolution.admission?.reasons).toContain('municipal_service');
    expect(r.publish_status).not.toMatch(/^published/);
  });

  it('Amt am Stettiner Haff: Amtskalender, der Titel nennt die Gemeinde, nicht die Kalender-Gemeinde', () => {
    const { url } = page('stettiner-haff');
    const g = groupFor(url);
    // Registry: Hintersee führt die Seite; die übrigen Amtsgemeinden teilen die Website.
    expect(g.own.map(e => e.name)).toEqual(['Hintersee']);
    expect(g.viaVerband.length).toBeGreaterThan(1);
    const t = byTitle(termine('stettiner-haff'), 'Halloween-Party, Eggesin');
    const r = row(t, url);
    expect(r.location_resolution.gemeinde?.name).toBe('Eggesin');
    expect((r.location_resolution as unknown as { allowed: { pin: boolean } }).allowed.pin).toBe(false);
  });
});

describe('Zeichensatz', () => {
  it('ISO-8859-1 aus <meta charset> nur mit charset, sonst wie bisher UTF-8', async () => {
    const { readHtml } = await import('@/lib/scrapers/fetch-html');
    const body = Buffer.from('<html><head><meta charset="iso-8859-1"></head><body>Schach für Jung & Alt</body></html>', 'latin1');
    const res = () => new Response(body, { headers: { 'content-type': 'text/html' } });
    expect((await readHtml(res(), { charset: true })).html).toContain('Schach für Jung');
    expect((await readHtml(res())).html).toContain('Schach f�r Jung');
  });
});

describe('Titel aus Links', () => {
  it('Knopf „› weiterlesen", Mail-Platzhalter und reine Uhrzeiten sind kein Name', () => {
    const html = `<ul>
      <li><a href="/a">› weiterlesen</a> 05.11.2026</li>
      <li><a href="/b">[email&#160;protected]</a> 06.11.2026</li>
      <li><a href="/c">Einlass 18:00 Uhr Beginn 19:00 Uhr</a> 07.11.2026</li>
      <li><a href="/d">Martinsumzug</a> 08.11.2026</li></ul>`;
    const list = parseAllgemeinPage(html, 'https://example.de/termine', TODAY);
    expect(list.map(t => t.title)).toEqual(['Martinsumzug']);
  });

  it('eingerückte Kachel: Uhrzeit hinter viel Leerraum zählt (Viersen „Uhrzeit 18:00 bis 19:30 Uhr")', () => {
    const pad = ' \n'.repeat(60);
    const html = `<ul><li><h3>Kultliedersingen</h3><dl><dt>Datum</dt>${pad}<dd>06.11.2026</dd>${pad}<dt>Uhrzeit</dt>${pad}<dd>18:00 bis 19:30 Uhr</dd></dl></li>
      <li><h3>Dancing</h3><dl><dt>Datum</dt><dd>06.11.2026</dd><dt>Uhrzeit</dt><dd>20:00 Uhr</dd></dl></li></ul>`;
    const t = byTitle(parseAllgemeinPage(html, 'https://example.de/termine', TODAY), 'Kultliedersingen');
    expect(t).toMatchObject({ start: '2026-11-06T17:00:00.000Z', end: '2026-11-06T18:30:00.000Z' });
  });

  it('Datum im Kopf und noch einmal vor der Uhrzeit (Augsburg „Christkindlesmarkt 2026")', () => {
    const t = 'Montag, 23.11.2026 Bildnachweis: Ruth Plössel/Stadt Augsburg Nov. 23 Christkindlesmarkt 2026 23.11.2026 18:00 Uhr - 21:30 Uhr Ticketpreis: kostenfrei';
    expect(recordTime(t, findDateExprs(t)[0])).toEqual({ start: '18:00', end: '21:30' });
  });

  it('Kopf ohne Jahr, anderes Datum im Text: kein Termin (Eitorf „Dorffest in Halft")', () => {
    const card = (head: string, name: string, body: string) => `<div class="ev"><p>${head} • 15:00 Uhr</p><h3>${name}</h3><p>${body}</p></div>`;
    const html = `<div>${card('JUNI 5. Juni', 'Dorffest in Halft', 'Vormerken: Kirmes am 12.-13.06.2027.')}${card('11.11.2026', 'Martinszug', 'Mit Laternen')}</div>`;
    const titles = parseAllgemeinPage(html, 'https://example.de/termine', TODAY).map(t => t.title);
    expect(titles).toEqual(['Martinszug']);
  });

  it('Uhrzeit nach langer Beschreibung, einzige Spanne der Kachel (Willich); „16.30 - 17.30 Uhr" (Altenmarkt)', () => {
    const t = 'Betrugsprävention im Alter 19. November 2026 Betrug erkennen, sicher handeln: Tipps der Polizei gegen aktuelle Betrugsmaschen. Veranstaltungsort Technisches Rathaus Zeit 15:00 Uhr - 16:30 Uhr';
    expect(recordTime(t, findDateExprs(t)[0])).toEqual({ start: '15:00', end: '16:30' });
    const t2 = 'Lesen mit Conny Ort: Bücherei Wann: 20.11.2026 | 16.30 - 17.30 Uhr';
    expect(recordTime(t2, findDateExprs(t2)[0])).toEqual({ start: '16:30', end: '17:30' });
  });

  it('Rubrik im Namens-Element gehört nicht zum Titel (Nettetal)', () => {
    const card = (n: string, c: string, d: string) => `<li><h3><a href="/v/${d}"><strong>${n}</strong></a> <span class="a5-event-box-category"><strong>${c}</strong></span></h3><ul><li>${d}</li></ul></li>`;
    const html = `<ul>${card('Adams Äpfel', 'Schauspiel', '12.02.2027')}${card('Bunter Abend', 'Brauchtum', '16.01.2027')}</ul>`;
    expect(parseAllgemeinPage(html, 'https://example.de/v', TODAY).map(t => t.title)).toEqual(['Adams Äpfel', 'Bunter Abend']);
  });

  it('Uhrzeit nur im Beschreibungstext ist nicht die des Termins; Wochentag im Namen bleibt (Wemding)', () => {
    const card = (n: string, d: string, body: string) => `<div class="ev"><h3>${n}</h3><span>${d}</span><p>${body}</p></div>`;
    const html = `<div>${card('Martinimarkt mit verkaufsoffenem Sonntag', '08.11.26', 'Der Fierantenmarkt lockt mit zahlreichen Aktionen und einem breiten Sortiment an Angeboten. Ab dem Nachmittag haben die Wemdinger Geschäfte ab 12:30 Uhr bis 17 Uhr geöffnet.')}
      ${card('Kaffeenachmittag', '10.11.26', 'Jeden zweiten Dienstag.')}</div>`;
    const t = byTitle(parseAllgemeinPage(html, 'https://example.de/v', TODAY), 'Martinimarkt mit verkaufsoffenem Sonntag');
    expect(t).toMatchObject({ start: '2026-11-08', allDay: true });
  });

  it('„von 16 bis 17 Uhr": Beginn 16 Uhr', () => {
    const text = '02.11.2026 Kreatives Basteln für Kinder von 16 bis 17 Uhr';
    expect(recordTime(text, findDateExprs(text)[0])).toEqual({ start: '16:00', end: '17:00' });
  });

  it('gleich viele Termine in Mikrodaten (nur Datum) und Liste (mit Uhrzeit): die Liste', () => {
    const card = (name: string, day: string) => `<tr itemscope itemtype="https://schema.org/Event"><td><meta itemprop="startDate" content="2026-12-${day}">${day}.12.2026</td><td>18:00 Uhr</td><td itemprop="name">${name}</td></tr>`;
    const html = `<table>${card('Familiengottesdienst', '24')}${card('Christmette', '25')}</table>`;
    const list = parseAllgemeinPage(html, 'https://example.de/termine', TODAY);
    expect(list.every(t => t.strategie === 'liste' && !t.allDay)).toBe(true);
  });

  it('Feld im Namens-Element fällt weg, der Ort ist kein Name, ein Ticket-Link auch nicht', () => {
    // Aufbau wie Sulzbach (Taunus), Baiern und Woldegk am 2026-10-29.
    const html = `<div class="list">
      <div><p>01.11.2026 - 10:00 Uhr</p><h2><span>Herbstmarkt</span> <p>Veranstaltungsort: Bürgerzentrum</p></h2></div>
      <div><p>08.11.2026 - 11:00 Uhr</p><h2><span>Kreativmarkt</span></h2></div></div>
      <div class="rows"><div class="termin"><div class="datum">17. Mär 2027 · 20:00 - 22:00</div><div class="terminText"> Osterschießen <div class="location"><div class="title">Netterndorf</div></div></div></div>
      <div class="termin"><div class="datum">19. Mär 2027 · 19:30</div><div class="terminText"> Osterhasenschießen <div class="location"><div class="title">Berganger</div></div></div></div></div>
      <ul class="tickets"><li>28.12.2026 ab 11 € <a href="https://www.reservix.de/tickets-x">Tickets kaufen</a></li><li>29.12.2026 ab 9 € <a href="https://www.reservix.de/tickets-y">Tickets kaufen</a></li></ul>`;
    const titles = parseAllgemeinPage(html, 'https://example.de/termine', TODAY).map(t => t.title);
    expect(titles).toContain('Herbstmarkt');
    expect(titles).not.toContain('Netterndorf');
    expect(titles).not.toContain('Tickets kaufen');
  });

  it('Folgeseite: Termin ohne Detailseite behält seine Identität', () => {
    const html = '<ul><li><b>Laternelaufen</b> 07.11.2026</li><li><b>Adventsmarkt</b> 28.11.2026</li></ul>';
    const [a] = parseAllgemeinPage(html, 'https://example.de/termine?from=20', TODAY, 'https://example.de/termine');
    const [b] = parseAllgemeinPage(html, 'https://example.de/termine?from=40', TODAY, 'https://example.de/termine');
    expect(allgemeinSourceId(a)).toBe(allgemeinSourceId(b));
  });
});

describe('Registry und Identität', () => {
  it('Startseiten erkennt der Adapter', () => {
    expect(isStartseite('https://www.havelberg.de/')).toBe(true);
    expect(isStartseite('https://www.amteider.de/index.php')).toBe(true);
    expect(isStartseite('https://www.kellinghusen.de/veranstaltungen')).toBe(false);
  });

  it('jeder Eintrag, den kein Hersteller-Adapter lesen kann, steht in genau einer Gruppe', () => {
    const groups = allgemeinGroups();
    const own = groups.flatMap(g => g.own);
    expect(new Set(own.map(e => e.ags)).size).toBe(own.length);
    // Eigene Integrationen vollständig; Aufgefangene, soweit kein Hersteller-Adapter die Website liest.
    const eigene = loadRegistryDe().filter(e => ['jsonld', 'html_generic', 'js_oder_feed'].includes(e.integration) && (e.url || e.host));
    expect(own.filter(e => ['jsonld', 'html_generic', 'js_oder_feed'].includes(e.integration)).length).toBe(eigene.length);
  });

  it('Auffang nie auf einer Website, die ein Hersteller-Adapter liest (Shards)', () => {
    const e = (ags: string, integration: string, url: string | null, feed_url?: string) => ({ ags, name: ags, land: 'bayern', host: 'a.de', stufe: 'A' as const, integration, url, ...(feed_url ? { feed_url } : {}), checked_at: '2026-11-06' });
    const groups = allgemeinGroups([e('1', 'ionas', 'https://a.de/kalender/', 'https://a.de/kalender/events.json'), e('2', 'ionas', 'https://a.de/termine/'), { ...e('3', 'ionas', 'https://b.de/termine/'), host: 'b.de' }]);
    expect(groups.map(g => g.feedUrl)).toEqual(['https://b.de/termine/']);
  });

  it('auffangen nur, was der Hersteller-Adapter nicht liest; Lizenzquellen nie', () => {
    expect(allgemeinSeite('ionas', 'https://a.de/k', 'https://a.de/k/events.json', 'a.de')).toBeNull();
    expect(allgemeinSeite('dpcalendar', 'https://a.de/k', undefined, 'a.de')).toBeNull();
    expect(allgemeinSeite('ionas', 'https://a.de/k', undefined, 'a.de')).toBe('https://a.de/k');
    expect(allgemeinSeite('tribe', null, undefined, 'www.a.de')).toBe('https://www.a.de/');
    expect(allgemeinSeite('txnews', 'https://a.de/k', undefined, 'a.de')).toBeNull();
    expect(allgemeinSeite('txnews', null, undefined, 'a.de')).toBe('https://www.a.de/');
    expect(allgemeinSeite('html_generic', null, undefined, 'a.de')).toBe('https://www.a.de/');
    for (const lizenz of ['nolis', 'heimatinfo', 'cross7', 'toubiz', 'meinort', 'fehler', 'kein_link']) {
      expect(allgemeinSeite(lizenz, 'https://a.de/k', undefined, 'a.de'), lizenz).toBeNull();
    }
  });

  it('source_id aus Detailseite und Tag, ohne Titeltext; stabil', () => {
    const t = byTitle(termine('kellinghusen'), 'Halloween im Museum - Der letzte Ton');
    const id = allgemeinSourceId(t);
    expect(id).toMatch(/^allg-kellinghusen\.de-[0-9a-f]{16}-2026-10-31$/);
    expect(allgemeinSourceId(byTitle(termine('kellinghusen'), 'Halloween im Museum - Der letzte Ton'))).toBe(id);
  });
});

describe('Startseite und Seite ohne Termine: Kalenderlinks', () => {
  const liste = `<ul>${[1, 2, 3].map(n => `<li><time datetime="2027-0${n}-01">01.0${n}.2027</time> <h3><a href="/t/${n}">Fest ${n}</a></h3></li>`).join('')}</ul>`;
  const seite = (body: string) => new Response(`<html><body>${body}</body></html>`, { headers: { 'content-type': 'text/html' } });
  const group = (url: string): FeedGroup => ({ feedUrl: url, pageUrl: url, own: [], viaVerband: [] });
  class Lauf extends AllgemeinDeScraper {
    protected delayMs = 0;
    constructor(private readonly groupsForTest: FeedGroup[]) { super(); }
    protected pickGroups() { return this.groupsForTest; }
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    resetHostGate();
  });

  it('Termine auf der Startseite zählen nicht, die verlinkte Kalenderseite schon', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const u = String(input);
      calls.push(u);
      if (u.endsWith('/robots.txt')) return new Response('', { status: 404 });
      if (u === 'https://a.example/') return seite(`${liste}<a href="/aktuelles/veranstaltungen/">Veranstaltungen</a><a href="/abfallkalender/">Abfall</a>`);
      if (u === 'https://a.example/aktuelles/veranstaltungen/') return seite(liste);
      return new Response('', { status: 404 });
    }));
    const s = new Lauf([group('https://a.example/')]);
    const events = await s.scrape();
    expect(events.length).toBe(3);
    expect(calls.some(u => u.includes('abfall'))).toBe(false);
    expect(s.kalenderBericht()[0]).toMatchObject({ ergebnis: 'gelesen', termine: 3 });
  });

  it('verlinkte Seite mit einem einzelnen Listentreffer ist ein Artikel, kein Kalender', () => {
    expect(istKalender([{ strategie: 'liste' }])).toBe(false);
    expect(istKalender([{ strategie: 'liste' }, { strategie: 'liste' }])).toBe(true);
    expect(istKalender([{ strategie: 'jsonld' }])).toBe(true);
    expect(istKalender([])).toBe(false);
  });

  it('Tabellenzeile: Datumszelle mit eigenem Text neben einer Textzelle ergibt keinen Titel (Ronneburg)', () => {
    const html = `<table><tr><td>Vereine der Stadt Ronneburg</td><td>Sonntag, 18.04.2027<br/>Tag der Vereine<br/>Ort: Bogenbinderhalle</td></tr><tr><td>Feuerwehr</td><td>Samstag, 24.04.2027<br/>Maibaum stellen<br/>Ort: Markt</td></tr></table>`;
    expect(parseAllgemeinPage(html, 'https://ronneburg.example/v', '').map(t => t.title)).not.toContain('Vereine der Stadt Ronneburg');
    const klar = `<table><tr><td>Sa, 24.04.2027, 14 Uhr</td><td>Maibaum stellen</td></tr><tr><td>Sonntag, 25.04.2027 ab 10 Uhr</td><td>Frühschoppen</td></tr></table>`;
    expect(parseAllgemeinPage(klar, 'https://b.example/v', '').map(t => t.title).sort()).toEqual(['Frühschoppen', 'Maibaum stellen']);
  });

  it('Seite mit Terminen: kein weiterer Abruf', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const u = String(input);
      calls.push(u);
      if (u.endsWith('/robots.txt')) return new Response('', { status: 404 });
      if (u === 'https://b.example/termine') return seite(`${liste}<a href="/veranstaltungen/">mehr</a>`);
      return new Response('', { status: 404 });
    }));
    const events = await new Lauf([group('https://b.example/termine')]).scrape();
    expect(events.length).toBe(3);
    expect(calls.filter(u => u.includes('/veranstaltungen/'))).toEqual([]);
  });
});
