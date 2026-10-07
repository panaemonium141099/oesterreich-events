import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { gem2goAdapter } from '../../adapters/gem2go';
import { enrichFromDetailHtml } from '../../extract';

describe('gem2goAdapter', () => {
  it('extracts via va-adr-* CSS classes', () => {
    const html = `<html><body>
      <span class="va-vaort">Pfarrsaal</span>
      <span class="va-adr-strasse">Kirchengasse</span>
      <span class="va-adr-hnr">7,</span>
      <span class="va-adr-plz">3040</span>
      <span class="va-adr-ort">Neulengbach</span>
      <div class="vatext_container"><div class="mehrtext-limiter">Konzert mit dem örtlichen Chor.</div></div>
    </body></html>`;
    const $ = cheerio.load(html);
    const r = gem2goAdapter.extract($, {}, 'https://gemeinde.example/');
    expect(r.location_name).toBe('Pfarrsaal');
    expect(r.address).toBe('Kirchengasse 7');
    expect(r.postal_code).toBe('3040');
    expect(r.address_locality).toBe('Neulengbach');
    expect(r.description).toContain('Konzert');
  });

  it('extracts organizer via veranstalter_bez_veranstalter class', () => {
    const html = `<html><body>
      <span class="veranstalter_bez_veranstalter">Musikverein Mönchdorf</span>
    </body></html>`;
    const $ = cheerio.load(html);
    const r = gem2goAdapter.extract($, {}, 'https://x');
    expect(r.organizer).toBe('Musikverein Mönchdorf');
  });

  it('falls back to vatext_container when mehrtext-limiter is empty', () => {
    const html = `<html><body>
      <div class="vatext_container">
        <span class="mehrtext-toggle">mehr anzeigen</span>
        Beschreibungstext der Veranstaltung mit vielen Details für die Besucher.
      </div>
    </body></html>`;
    const $ = cheerio.load(html);
    const r = gem2goAdapter.extract($, {}, 'https://x');
    expect(r.description).toContain('Beschreibungstext');
    expect(r.description).not.toContain('mehr anzeigen');
  });

  it('drops description = "mehr anzeigen"', () => {
    const html = `<html><body>
      <div class="vatext_container"><span class="mehrtext-limiter">mehr anzeigen</span></div>
    </body></html>`;
    const $ = cheerio.load(html);
    const r = gem2goAdapter.extract($, {}, 'https://x');
    expect(r.description).toBeUndefined();
  });
});

// Neues gem2go-Detaillayout (BEM), Ausschnitte echter Seiten (abgerufen 2026-10-07).
// Ort steht im Block "Kontakt" (.bemContainer--contact), der Veranstalter mit
// eigener Adresse in .bemContainer--mainHostContact, die Gemeindeamt-Adresse
// in #footer. Vorher lieferte der Extraktor auf allen vier Seiten eine falsche
// Adresse (Fußzeile, bei Andorf gemischt mit der PLZ des Veranstalters).
describe('gem2go Detailseiten im neuen Layout', () => {
  const FIX = path.join(__dirname, '..', 'fixtures', 'gem2go');
  const extract = (f: string) => enrichFromDetailHtml('gem2go', '', fs.readFileSync(path.join(FIX, f), 'utf8'));

  it('liest den Ort aus dem Kontaktblock, nicht die Adresse des Veranstalters', () => {
    expect(extract('andorf-sporthalle.html')).toMatchObject({
      location_name: 'Sporthalle Andorf',
      address: 'Hans-Holz-Straße 1',
      postal_code: '4770',
      address_locality: 'Andorf',
      organizer: 'Andorfer Chöre',
    });
  });

  it('nimmt den Standort, wenn keine Veranstaltungsstätte genannt ist', () => {
    expect(extract('deutschlandsberg-burgmuseum.html')).toMatchObject({
      location_name: 'Burgmuseum Archeo Norico',
      address: 'Burgplatz 2',
      postal_code: '8530',
    });
  });

  it('nimmt bei Adresse ohne Hausnummer nicht die Fußzeile', () => {
    // Quelle: "Hauptplatz, 2440 Moosbrunn"; Fußzeile: Gemeindeamt "Hauptplatz 9".
    // Adressen ohne Hausnummer verwirft die Gültigkeitsprüfung, Ort und PLZ bleiben.
    const r = extract('moosbrunn-punschstand.html');
    expect(r).toMatchObject({ location_name: 'Kirchenvorplatz', postal_code: '2440', address_locality: 'Moosbrunn' });
    expect(r.address).toBeUndefined();
  });

  it('nimmt ohne Ortsadresse auch nicht die Adresse aus dem Veranstalterblock', () => {
    // Andorf ohne den Eintrag "Adresse" im Kontaktblock: der Veranstalter sitzt in Lambrechten.
    const $ = cheerio.load(fs.readFileSync(path.join(FIX, 'andorf-sporthalle.html'), 'utf8'));
    $('.bemContainer--contact li.bemList__item').filter((_, li) => $(li).find('.sr-only').text().trim() === 'Adresse').remove();
    const r = enrichFromDetailHtml('gem2go', '', $.html());
    expect(r.location_name).toBe('Sporthalle Andorf');
    expect(r.postal_code).not.toBe('4772');
    expect(r.address ?? '').not.toContain('Lambrechten');
    expect(r.organizer).toBe('Andorfer Chöre');
  });

  it('nimmt die Veranstalter-Adresse aus dem JSON-LD nicht als Ort', () => {
    // gem2go schreibt die Adresse des Veranstalters (Lambrechten) als location ins JSON-LD.
    const r = extract('andorf-sporthalle.html');
    expect(r.address_locality).toBe('Andorf');
    expect(r.description).toContain('50 Jahre');
  });

  it('ohne Kontaktblock bleibt die Adresse leer, die Fußzeile zählt nicht', () => {
    const r = extract('pram-buchausstellung.html');
    expect(r.address).toBeUndefined();
    expect(r.postal_code).toBeUndefined();
    expect(r.description).toBe('Buchausstellung im Pfarrheim Pram');
  });

  it('zerlegt Adressen ohne Straße und mit Länderzusatz', () => {
    const li = (label: string, value: string) =>
      `<li class="bemList__item"><span class="sr-only">${label}</span><span class="bemText__value">${value}</span></li>`;
    const page = (adr: string) =>
      cheerio.load(`<div class="bemContainer bemContainer--contact"><ul class="bemList">${li('Adresse', adr)}</ul></div>`);
    expect(gem2goAdapter.extract(page('3681 Hofamt Priel'), {}, '')).toMatchObject({ postal_code: '3681', address_locality: 'Hofamt Priel' });
    expect(gem2goAdapter.extract(page('3681 Hofamt Priel'), {}, '').address).toBeUndefined();
    expect(gem2goAdapter.extract(page('Europastraße, 3902 Vitis, Österreich'), {}, '')).toMatchObject({
      address: 'Europastraße',
      postal_code: '3902',
      address_locality: 'Vitis',
    });
  });
});
