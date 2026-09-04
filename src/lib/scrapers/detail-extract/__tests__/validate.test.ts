import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import { isValidAddressText, isValidHtml, isContactHandleTitle } from '../validate';

describe('isValidAddressText', () => {
  it('accepts a street with house number', () => {
    expect(isValidAddressText('Schlossplatz 1')).toBe(true);
    expect(isValidAddressText('Hauptstraße 12a')).toBe(true);
    expect(isValidAddressText('Kirchgasse 7')).toBe(true);
    expect(isValidAddressText('Roland-Rainer-Platz 1')).toBe(true);
  });

  it('rejects strings shorter than 4 chars', () => {
    expect(isValidAddressText('A 1')).toBe(false);
    expect(isValidAddressText('')).toBe(false);
    expect(isValidAddressText(undefined)).toBe(false);
  });

  it('rejects non-address tokens followed by a number', () => {
    expect(isValidAddressText('Tisch 5')).toBe(false);
    expect(isValidAddressText('Saal 5')).toBe(false);
    expect(isValidAddressText('12. Bezirk')).toBe(false);
    expect(isValidAddressText('Reihe 3')).toBe(false);
    expect(isValidAddressText('ab 18')).toBe(false);
    expect(isValidAddressText('Tor 4')).toBe(false);
  });

  it('rejects street-name-only without number', () => {
    expect(isValidAddressText('Hauptstraße')).toBe(false);
    expect(isValidAddressText('Kirchplatz')).toBe(false);
  });
});

describe('isValidHtml', () => {
  it('accepts a normal event-detail page', () => {
    const html = `<html><head><title>Konzert</title></head>
      <body><main><h1>Konzert</h1><p>${'x'.repeat(300)}</p></main></body></html>`;
    const $ = cheerio.load(html);
    expect(isValidHtml(html, $)).toBe(true);
  });

  it('rejects 404 / not-found pages', () => {
    const html = `<html><head><title>404 - Not Found</title></head>
      <body><main>${'x'.repeat(300)}</main></body></html>`;
    const $ = cheerio.load(html);
    expect(isValidHtml(html, $)).toBe(false);
  });

  it('rejects maintenance pages', () => {
    const html = `<html><head><title>Wartung</title></head>
      <body><main>${'x'.repeat(300)}</main></body></html>`;
    const $ = cheerio.load(html);
    expect(isValidHtml(html, $)).toBe(false);
  });

  it('rejects pages with very short body text', () => {
    const html = `<html><head><title>Event</title></head><body><main>Hi</main></body></html>`;
    const $ = cheerio.load(html);
    expect(isValidHtml(html, $)).toBe(false);
  });

  it('rejects pages dominated by cookie consent', () => {
    const cookies = 'cookie datenschutz akzeptieren cookie banner cookie wir verwenden cookies '.repeat(50);
    const html = `<html><head><title>Event</title></head><body><main>${cookies}</main></body></html>`;
    const $ = cheerio.load(html);
    expect(isValidHtml(html, $)).toBe(false);
  });
});

describe('isContactHandleTitle', () => {
  // Prod-Befund 2026-09-04: 613 Events mit reiner E-Mail als Titel,
  // 604 davon mit source_url = "mailto:…" (Quelle: gemeinden-generic).
  it('rejects a bare email address', () => {
    expect(isContactHandleTitle('contact@tennis-henndorf.com')).toBe(true);
    expect(isContactHandleTitle('seniorenbund.henndorf@outlook.com')).toBe(true);
    expect(isContactHandleTitle('jenny.edelsbacher@gmx.net')).toBe(true);
    expect(isContactHandleTitle('SHOCHWIMMER@GMX.AT')).toBe(true);
    expect(isContactHandleTitle('  info@musikschildorn.at  ')).toBe(true);
  });

  it('rejects mailto:/tel: href text that leaked into the title', () => {
    expect(isContactHandleTitle('mailto:info@sibra.cnv.at')).toBe(true);
    expect(isContactHandleTitle('tel:+4338678044')).toBe(true);
  });

  it('rejects bare phone numbers with country/area prefix', () => {
    expect(isContactHandleTitle('+43 732 221 055 0')).toBe(true);
    expect(isContactHandleTitle('+43 6542 56531')).toBe(true);
    expect(isContactHandleTitle('0699/1865 23 45')).toBe(true);
  });

  it('keeps real titles that merely contain an address or number', () => {
    expect(isContactHandleTitle('Anmeldung bei info@verein.at')).toBe(false);
    expect(isContactHandleTitle('Sommerfest 2026')).toBe(false);
    expect(isContactHandleTitle('2026 / 2027')).toBe(false);
    expect(isContactHandleTitle('1000 Jahre Henndorf')).toBe(false);
  });

  it('keeps URL-shaped titles — those have real false positives', () => {
    // Echtes Eventim-Event: der Artist heisst so.
    expect(isContactHandleTitle('www.illeg.art präsentiert Hemso')).toBe(false);
    expect(isContactHandleTitle('www.seendialog.at')).toBe(false);
  });

  it('handles empty input', () => {
    expect(isContactHandleTitle('')).toBe(false);
    expect(isContactHandleTitle('   ')).toBe(false);
    expect(isContactHandleTitle(undefined)).toBe(false);
    expect(isContactHandleTitle(null)).toBe(false);
  });
});
