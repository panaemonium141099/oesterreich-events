/**
 * resolvePrimaryEventImage — Bedeutung von events.image_width.
 *
 * Festgeschrieben, weil der Unterschied zwischen "geprueft und tot" (0) und
 * "noch nicht vermessen" (null/-1) vorher nicht existierte: probe-image-widths
 * schrieb bei jedem Fehlschlag -1, der Resolver wertete -1 als unbekannt und
 * lieferte tote URLs weiter aus. Ergebnis war ein kaputtes Bild in der Karte.
 */
import { describe, it, expect } from 'vitest';
import { resolvePrimaryEventImage, MIN_TRUSTED_EVENT_IMAGE_WIDTH } from '@/lib/event-images/resolveEventImage';

const REMOTE = 'https://example.com/bild.jpg';
const base = { imageUrl: REMOTE, category: 'Musik', title: 'Testkonzert', bundesland: 'wien' };
const isFallback = (s: string) => s.startsWith('/images/categories/');

describe('resolvePrimaryEventImage — image_width', () => {
  it('behaelt das Original bei ausreichender gemessener Breite', () => {
    expect(resolvePrimaryEventImage({ ...base, imageWidth: 1200 })).toBe(REMOTE);
  });

  it('ersetzt zu kleine Bilder durch den Kategorie-Fallback', () => {
    const r = resolvePrimaryEventImage({ ...base, imageWidth: MIN_TRUSTED_EVENT_IMAGE_WIDTH - 1 });
    expect(isFallback(r)).toBe(true);
  });

  it('ersetzt als tot markierte Bilder (0) durch den Fallback', () => {
    expect(isFallback(resolvePrimaryEventImage({ ...base, imageWidth: 0 }))).toBe(true);
  });

  it('behaelt das Original bei -1 (nicht messbar, spaeter erneut pruefen)', () => {
    expect(resolvePrimaryEventImage({ ...base, imageWidth: -1 })).toBe(REMOTE);
  });

  it('behaelt das Original bei null (noch nicht vermessen)', () => {
    expect(resolvePrimaryEventImage({ ...base, imageWidth: null })).toBe(REMOTE);
  });

  it('nimmt den Fallback, wenn gar keine URL da ist', () => {
    expect(isFallback(resolvePrimaryEventImage({ ...base, imageUrl: null, imageWidth: 1200 }))).toBe(true);
  });
});
