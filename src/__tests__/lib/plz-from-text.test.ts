/**
 * Eine im Titel ausdruecklich genannte PLZ ist eine Ortsangabe der Quelle.
 *
 * Prod-Befund 2026-09-06: 236 veroeffentlichte `boudicca:flohmarkt`-Events
 * lagen unter einer fremden PLZ und damit im falschen Bundesland, obwohl
 * ihr eigener Titel die richtige PLZ nannte — Wiener Flohmaerkte auf den
 * Hub-Seiten von Vorarlberg und Kaernten.
 */
import { describe, it, expect } from 'vitest';
import { extractPostalCodeFromText } from '@/lib/location-normalizer';

describe('extractPostalCodeFromText', () => {
  it('liest die PLZ aus der Form "in <PLZ> <Ort>"', () => {
    expect(extractPostalCodeFromText('Privat Flohmarkt in 1230 Wien')).toBe('1230');
    expect(extractPostalCodeFromText('kleiner, feiner Pfarrflohmarkt in 1140 Wien')).toBe('1140');
    expect(extractPostalCodeFromText('1. Castellino Hausflohmarkt in 9020 Klagenfurt')).toBe('9020');
  });

  it('haelt Jahreszahlen NICHT fuer eine PLZ', () => {
    // Ohne die Praeposition und den grossgeschriebenen Ortsnamen gibt es
    // keinen Treffer — sonst wuerde jedes Datum zur Postleitzahl.
    expect(extractPostalCodeFromText('17.10.2026 Kasperl & das kunterbunte Rundherum')).toBeNull();
    expect(extractPostalCodeFromText('Kammermusik 2026/2027 Bennewitz Quartett')).toBeNull();
    expect(extractPostalCodeFromText('Schnöde Bescherung 2026 Edi Jäger')).toBeNull();
    expect(extractPostalCodeFromText('Große Kostümsitzung 2027 Deutzer Karnevalsgesellschaft')).toBeNull();
  });

  it('respektiert die Wortgrenze vor "in"', () => {
    // "Berlin 1230 Wien" darf nicht ueber das "in" in "Berlin" matchen.
    expect(extractPostalCodeFromText('Konzert Berlin 1230 Wien')).toBeNull();
  });

  it('verlangt eine existierende oesterreichische PLZ', () => {
    expect(extractPostalCodeFromText('Fest in 0000 Nirgendwo')).toBeNull();
  });

  it('ist robust gegen leere Eingaben', () => {
    expect(extractPostalCodeFromText(null)).toBeNull();
    expect(extractPostalCodeFromText(undefined)).toBeNull();
    expect(extractPostalCodeFromText('')).toBeNull();
  });
});
