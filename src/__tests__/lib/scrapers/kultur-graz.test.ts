import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { KulturGrazScraper } from '@/lib/scrapers/KulturGrazScraper';
import { enrichFromDetailHtml } from '@/lib/scrapers/detail-extract/extract';
import { cleanKulturGrazVenue } from '@/lib/scrapers/kultur-graz-venue';

// Gespeicherte Seiten von kultur.graz.at (abgerufen 2026-09-24).
const FIX = path.join(__dirname, 'fixtures', 'kultur-graz');
const read = (f: string) => fs.readFileSync(path.join(FIX, f), 'utf8');

describe('KulturGrazScraper Tagesseite', () => {
  const events = new KulturGrazScraper().parseDayPage(read('tag-20260926.html'), '2026-09-26');
  const byId = (id: string) => events.find((e) => e.source_id === `kultur-graz-${id}`);

  it('liest den Veranstaltungsort aus der Eventliste', () => {
    expect(byId('1788769785')).toMatchObject({
      title: 'Black Sea Dahu',
      start_date: '2026-09-26T19:00',
      location_name: 'p.p.c',
      source_url: 'https://kultur.graz.at/kalender/event/1788769785',
    });
    expect(byId('1786433423')?.location_name).toBe('Dom im Berg');
  });

  it('nimmt die Listenzeile statt der Highlight-Karte', () => {
    // Die Karte oben führt „Eröffnung / Das kolossale Landtier / 12:00 Uhr - rotor" in einem Link.
    expect(byId('1790060171')).toMatchObject({ title: 'Das kolossale Landtier', location_name: 'rotor' });
  });

  it('setzt nie Stadt, Zeitlabel oder Bildunterschrift als Ort', () => {
    expect(events.length).toBeGreaterThan(60);
    for (const e of events) {
      expect(e.title).not.toMatch(/\n|Uhr - /);
      if (e.location_name === undefined) continue;
      expect(e.location_name).not.toMatch(/^(Graz|Beginnzeit nicht bekannt|Ganztägig|Eröffnung|Vernissage|Premiere)$/);
      expect(e.location_name).not.toMatch(/Info:|Foto:|↗|Uhr/);
    }
    // Nur die 7 Stadtgebiet-Termine (Quelle: Ort „Graz") bleiben ohne Venue.
    expect(events.filter((e) => !e.location_name).length).toBe(7);
  });

  it('Termine ohne Beginnzeit bekommen nur das Datum', () => {
    const noTime = events.filter((e) => !e.start_date.includes('T'));
    expect(noTime.length).toBeGreaterThan(0);
    expect(noTime.every((e) => e.start_date === '2026-09-26')).toBe(true);
  });
});

describe('kultur-graz Detailseite', () => {
  it('liest den Ort aus dem Infoblock, die Adresse bleibt', () => {
    const r = enrichFromDetailHtml('kultur-graz', 'https://kultur.graz.at/kalender/event/1788769785', read('event-1788769785.html'));
    expect(r.location_name).toBe('p.p.c');
    expect(r.address).toBe('Neubaugasse 6');
    expect(r.postal_code).toBe('8020');
  });

  it('Ort „Graz" (Stadtgebiet) bleibt leer', () => {
    const r = enrichFromDetailHtml('kultur-graz', 'https://kultur.graz.at/kalender/event/1779445150', read('event-1779445150.html'));
    expect(r.location_name).toBeUndefined();
  });
});

describe('cleanKulturGrazVenue', () => {
  it('verwirft Stadt, Zeitlabels und Bildunterschriften', () => {
    expect(cleanKulturGrazVenue(' - p.p.c')).toBe('p.p.c');
    expect(cleanKulturGrazVenue(' - Schaumbad – Freies Atelierhaus Graz')).toBe('Schaumbad – Freies Atelierhaus Graz');
    expect(cleanKulturGrazVenue('Graz')).toBeUndefined();
    expect(cleanKulturGrazVenue('Beginnzeit nicht bekannt')).toBeUndefined();
    expect(cleanKulturGrazVenue('Ganztägig')).toBeUndefined();
    expect(cleanKulturGrazVenue('Dom im Berg Info: spielstaetten.buehnen-graz.com ↗ Foto: kk')).toBeUndefined();
    expect(cleanKulturGrazVenue('')).toBeUndefined();
  });
});
