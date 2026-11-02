/**
 * Amts- und VG-Kalender als Ausweichweg (fn-29.17): Gruppen der Adapter
 * (gleicher Kalender, Gemeinde vor Amt), Ausweichwege in MEC und communice,
 * Prüfstand-Sicht `de-amt-vg`, Etiketten-Regel und Golden-Tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toSupabaseRow } from '@/lib/db/supabase-sync';
import type { ScrapedEvent } from '@/types/events';
import type { RegistryEntryDe } from '@/lib/registry-de/build';
import { calendarKey, feedGroups, loadRegistryDe, pickFeedGroups, type FeedGroup } from '@/lib/registry-de/load';
import { ionasIcsUrl, parseIonasIcs } from '@/lib/scrapers/de/ionas';
import { IonasDeScraper } from '@/lib/scrapers/de/IonasDeScraper';
import { parseNolisIcs } from '@/lib/scrapers/de/nolis';
import { NolisDeScraper } from '@/lib/scrapers/de/NolisDeScraper';
import { parseTribePage } from '@/lib/scrapers/de/tribe';
import { TribeDeScraper } from '@/lib/scrapers/de/TribeDeScraper';
import { communiceGroups } from '@/lib/scrapers/de/CommuniceDeScraper';
import { mecGroups } from '@/lib/scrapers/de/MecDeScraper';
import { DE_SCRAPERS, getDeScraperByName } from '@/lib/scrapers/de';
import { feedGemeinden, namedMember } from '@/lib/scrapers/de/kontext';

const entry = (o: Partial<RegistryEntryDe>): RegistryEntryDe => ({
  ags: '01053114', name: 'X', land: 'schleswig-holstein', host: null, stufe: 'A', integration: 'ionas', url: null, checked_at: '2026-10-28', ...o,
});
const group = (feedUrl: string, own: RegistryEntryDe[], viaVerband: RegistryEntryDe[] = []): FeedGroup => ({ feedUrl, pageUrl: feedUrl, own, viaVerband });

describe('pickFeedGroups', () => {
  it('derselbe Kalender in zwei Schreibweisen ist einer (Amt Nordsee-Treene http/https)', () => {
    expect(calendarKey('http://www.amt-nordsee-treene.de/eTermin/')).toBe(calendarKey('https://amt-nordsee-treene.de/eTermin'));
    expect(calendarKey('https://x.de/k?a=1&amp;b=2')).toBe(calendarKey('https://x.de/k?a=1&b=2'));
    const mildstedt = entry({ ags: '01054088', name: 'Mildstedt', stufe: 'B', integration: 'ikiss' });
    const hude = entry({ ags: '01054053', name: 'Hude', stufe: 'B', integration: 'ikiss' });
    const wisch = entry({ ags: '01054153', name: 'Wisch', stufe: 'V', integration: 'leer' });
    const out = pickFeedGroups([
      group('http://www.amt-nordsee-treene.de/eTermin/', [mildstedt]),
      group('https://www.amt-nordsee-treene.de/eTermin/', [hude], [wisch]),
    ]);
    expect(out).toHaveLength(1);
    // Ein Amtskalender: Mildstedt allein gäbe allen Terminen des Amts Mildstedt als Ort.
    expect(out[0].feedUrl).toBe('https://www.amt-nordsee-treene.de/eTermin/');
    expect(out[0].own.map(e => e.name).sort()).toEqual(['Hude', 'Mildstedt']);
    expect(out[0].viaVerband.map(e => e.name)).toEqual(['Wisch']);
  });

  it('ionas: events.json mit und ohne Ansichts-Parameter ist ein Kalender (Lambsheim-Heßheim)', () => {
    const groups = feedGroups('ionas', loadRegistryDe()).filter(g => g.feedUrl.includes('lambsheim-hessheim.de/kalender/'));
    expect(groups).toHaveLength(2);
    const out = pickFeedGroups(groups, { key: u => ionasIcsUrl(u, '', '') });
    expect(out).toHaveLength(1);
    expect(out[0].own.map(e => e.name).sort()).toEqual(['Heßheim', 'Kleinniedesheim']);
    expect(out[0].viaVerband.length).toBeGreaterThan(0);
  });

  it('Kalender genau einer Gemeinde vor den Amtskalendern (erste Zeile je source_id gilt)', () => {
    const amt = group('https://www.ahlden.info/de/kalender/events.json', [entry({ ags: '03358001', name: 'Ahlden' }), entry({ ags: '03358007', name: 'Eickeloh' })], [entry({ ags: '03358010', name: 'Hodenhagen', stufe: 'V' })]);
    const grethem = group('https://www.ahlden.info/de/kalender/grethem/events.json', [entry({ ags: '03358008', name: 'Grethem' })]);
    expect(pickFeedGroups([amt, grethem]).map(g => g.feedUrl)).toEqual([grethem.feedUrl, amt.feedUrl]);
  });

  it('onlyVerband: nur Kalender mit Ausweich-Gemeinden; eine Gemeinde, die ihn selbst führt, zählt dort nicht doppelt', () => {
    const a = entry({ ags: '1', name: 'A' });
    const b = entry({ ags: '2', name: 'B', stufe: 'V' });
    const out = pickFeedGroups([group('https://amt.de/k', [a], [b, a]), group('https://a.de/k', [a])], { onlyVerband: true });
    expect(out.map(g => g.feedUrl)).toEqual(['https://amt.de/k']);
    expect(out[0].viaVerband.map(e => e.name)).toEqual(['B']);
  });
});

describe('Ausweichwege in den Adaptern', () => {
  it('MEC liest die Kalender, die Gemeinden über ihre VG nutzen (Krostitz)', () => {
    const via = mecGroups().flatMap(g => g.viaVerband.map(e => `${e.name} ${g.pageUrl}`));
    expect(via.some(x => x.includes('krostitz.de/leben-soziales/veranstaltungen/'))).toBe(true);
  });

  it('communice: Amt ohne Kalenderseite über die Standardseite des Herstellers (Amt Probstei)', () => {
    const g = communiceGroups().find(x => x.viaVerband.some(e => e.fallback?.kind === 'verband' && e.fallback.host === 'amt-probstei.de'));
    expect(g?.pageUrl).toBe('https://www.amt-probstei.de/veranstaltungen');
  });

  it('de-amt-vg ist nur Prüfstand: nicht im Adapter-Satz des Nachtlaufs', () => {
    expect(DE_SCRAPERS.map(s => s.name)).not.toContain('de-amt-vg');
    expect(getDeScraperByName('de-amt-vg')?.name).toBe('de-amt-vg');
  });
});

describe('Etiketten-Regel: die Verwaltung ist kein Ort', () => {
  // Samtgemeinde Hanstedt (Hanstedt, Egestorf u. a.), Samtgemeinde Lemförde (Lembruch u. a.).
  const sgHanstedt = feedGemeinden([{ ags: '03353016' }]);
  const sgLemfoerde = feedGemeinden([{ ags: '03251022' }]);

  it('„Samtgemeinde Hanstedt“ nennt nicht die Gemeinde Hanstedt (Ausschuss der Gemeinde Egestorf, 25.11.2026)', () => {
    expect(sgHanstedt.map(g => g.name)).toContain('Egestorf');
    expect(namedMember({ title: 'Sitzung des Ausschusses für Jugend, Sport Kultur und Tourismus der Gemeinde Egestorf', locationName: 'Samtgemeinde Hanstedt' }, sgHanstedt)).toBeNull();
    expect(namedMember({ title: 'Sitzung', locationName: 'Rathaus der Samtgemeinde Hanstedt' }, sgHanstedt)).toBeNull();
    expect(namedMember({ title: 'Wochenmarkt', locationName: 'Alter Geidenhof Hanstedt' }, sgHanstedt)?.name).toBe('Hanstedt');
  });

  it('der genannte Ort vor dem Etikett gilt weiter („Lembruch, Samtgemeinde Lemförde“)', () => {
    expect(namedMember({ title: 'Sitzung', locationName: 'Lembruch, Samtgemeinde Lemförde' }, sgLemfoerde)?.name).toBe('Lembruch');
    // „SG“ ist meist die Sportgemeinschaft und bleibt ein Name.
    expect(namedMember({ title: 'Training', locationName: 'Sportheim SG Lembruch' }, sgLemfoerde)?.name).toBe('Lembruch');
  });
});

/**
 * Golden-Tests auf echten Amtskalendern (abgerufen 2026-11-02 im Prüfstand
 * `de-amt-vg`), je Land einer: VG Lauterecken-Wolfstein (RP, ionas),
 * Samtgemeinde Sottrum (NI, NOLIS, Feed seit fn-29.17 von der Startseite),
 * Amt Odervorland (BB, The Events Calendar). Gruppen aus der echten Registry.
 */
describe('Golden: Amtskalender → Zeile', () => {
  const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', 'amt-vg', f), 'utf8');
  type Row = { start_date: string; end_date: string | null; publish_status: string; location_resolution: { gemeinde: { name: string } | null; admission?: { reasons?: string[] } } };
  const row = (s: ScrapedEvent) => toSupabaseRow(s, new Map(), new Map()).row as unknown as Row;
  const amt = (groups: FeedGroup[], host: string) => {
    const g = groups.find(x => x.feedUrl.includes(host));
    if (!g) throw new Error(`kein Amtskalender ${host}`);
    return g;
  };

  describe('VG Lauterecken-Wolfstein (Rheinland-Pfalz, ionas)', () => {
    const g = amt(pickFeedGroups(feedGroups('ionas'), { onlyVerband: true, key: u => ionasIcsUrl(u, '', '') }), 'vg-lw.de');
    const evs = parseIonasIcs(fx('vg-lauterecken-wolfstein.ics'));
    const s = new IonasDeScraper();
    const one = (title: string) => row(s.toScraped(evs.find(e => e.title === title)!, g));

    it('der Kalender ist ein Amtskalender: Hinzweiler liest ihn über die VG', () => {
      expect(g.viaVerband.map(e => e.name)).toContain('Hinzweiler');
      expect(evs).toHaveLength(68);
    });

    it('Dorffest: „Schlachtfest beim PWV Hinzweiler“ ganztägig am 22.11.2026 in Hinzweiler', () => {
      const r = one('Schlachtfest beim PWV Hinzweiler');
      expect(r.start_date).toBe('2026-11-22');
      expect(r.location_resolution.gemeinde?.name).toBe('Hinzweiler');
      expect(r.publish_status).toBe('published');
    });

    it('Gemeinde aus dem Titel („in Grumbach“), Wandzeit mit Winter-Offset', () => {
      const r = one('Laternenumzug der Kita Piepmatz in Grumbach');
      expect(r.location_resolution.gemeinde?.name).toBe('Grumbach');
      // 05.11.2026 17:30 MEZ
      expect(r.start_date).toBe('2026-11-05T16:30:00.000Z');
    });

    it('Termin ohne Ort und ohne genannte Gemeinde: kein Ort, Quarantäne', () => {
      const r = one('Preisschafskopf');
      expect(r.location_resolution.gemeinde).toBeNull();
      expect(r.publish_status).toBe('needs_review');
    });
  });

  describe('Samtgemeinde Sottrum (Niedersachsen, NOLIS)', () => {
    const g = amt(pickFeedGroups(feedGroups('nolis'), { onlyVerband: true }), 'sottrum.de');
    const evs = parseNolisIcs(fx('samtgemeinde-sottrum.ics'));
    const s = new NolisDeScraper();
    const one = (title: string) => row(s.toScraped(evs.find(e => e.title === title)!, g));

    it('Termin in der Mitgliedsgemeinde Horstedt: deren Ort, 15:30 MEZ', () => {
      const r = one('Kindergottesdienst in Horstedt');
      expect(r.location_resolution.gemeinde?.name).toBe('Horstedt');
      expect(r.start_date).toBe('2026-12-10T14:30:00.000Z');
      expect(r.publish_status).toBe('published');
    });

    it('Gemeinde-Dienst: Bürgermeistersprechstunde in Quarantäne', () => {
      const r = one('Bürgermeistersprechstunde');
      expect(r.location_resolution.admission?.reasons).toContain('municipal_service');
      expect(r.publish_status).toBe('needs_review');
    });

    it('ganztägig bleibt ganztägig (00:00 Ortszeit ohne Ende)', () => {
      expect(one('Bundesweiter Kinderturntag in Sottrum').start_date).toBe('2026-11-07');
    });
  });

  describe('Amt Odervorland (Brandenburg, The Events Calendar)', () => {
    const g = amt(pickFeedGroups(feedGroups('tribe'), { onlyVerband: true }), 'amt-odervorland.de');
    const evs = parseTribePage(fx('amt-odervorland.json')).events;
    const s = new TribeDeScraper();
    const one = (prefix: string) => row(s.toScraped(evs.find(e => e.title.startsWith(prefix))!, g));

    it('Adresse in der Mitgliedsgemeinde Briesen (Mark): deren Ort, 10:00 MEZ', () => {
      const r = one('Äste ab');
      expect(r.location_resolution.gemeinde?.name).toBe('Briesen (Mark)');
      expect(r.start_date).toBe('2026-11-07T09:00:00.000Z');
      expect(r.publish_status).toBe('published');
    });

    it('„Steinhöfel OT Jänickendorf“ ohne Straße: Ort nicht belegt, Quarantäne statt Amtsmittelpunkt', () => {
      const r = one('Glühweinfest in Jänickendorf');
      expect(r.start_date).toBe('2026-11-28');
      expect(r.location_resolution.gemeinde).toBeNull();
      expect(r.publish_status).toBe('needs_review');
    });
  });
});
