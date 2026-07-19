import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * fn-17 Slice 3 — Guards der Lazy-Übersetzung.
 *
 * Der Gemini-Call und der Supabase-Write werden gemockt; getestet wird die
 * Entscheidungslogik: Cache-Hit ohne API-Call, Past-Event-/Key-Guards,
 * Fallback auf Deutsch (null) bei Fehlern.
 */

const generateContentMock = vi.fn();
const updateEqMock = vi.fn().mockResolvedValue({ error: null });

vi.mock('@google/genai', () => ({
  // WICHTIG: function statt Arrow — die Lib ruft `new GoogleGenAI(...)` auf,
  // und Arrow-Functions sind keine Konstruktoren (Mock würde sonst werfen
  // und die Lib fiele still auf Deutsch zurück).
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { models: { generateContent: generateContentMock } };
  }),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING' },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({ update: () => ({ eq: updateEqMock }) }),
  })),
}));

import { getOrTranslateEventEn } from '@/lib/i18n/translate-event';

const FUTURE = '2099-01-01T20:00:00+00:00';
const PAST = '2020-01-01T20:00:00+00:00';

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Weinfest am Hauptplatz',
    description: 'Ein Fest mit regionalen Winzern.',
    start_date: FUTURE,
    ...overrides,
  };
}

describe('getOrTranslateEventEn', () => {
  beforeEach(() => {
    generateContentMock.mockClear();
    updateEqMock.mockClear();
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it('Cache-Hit: liefert DB-Werte ohne Gemini-Call', async () => {
    const res = await getOrTranslateEventEn(
      baseEvent({ title_en: 'Wine festival', description_en: 'A festival.' }),
    );
    expect(res).toEqual({ title_en: 'Wine festival', description_en: 'A festival.' });
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('Past-Event: null, kein Gemini-Call', async () => {
    const res = await getOrTranslateEventEn(baseEvent({ start_date: PAST }));
    expect(res).toBeNull();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('fehlender GEMINI_API_KEY: null, kein Call', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await getOrTranslateEventEn(baseEvent());
    expect(res).toBeNull();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it('übersetzt Future-Event und schreibt in die DB zurück', async () => {
    generateContentMock.mockResolvedValueOnce({
      text: JSON.stringify({ title_en: 'Wine festival on the main square', description_en: 'A festival with regional winemakers.' }),
    });
    const res = await getOrTranslateEventEn(baseEvent());
    expect(res).toEqual({
      title_en: 'Wine festival on the main square',
      description_en: 'A festival with regional winemakers.',
    });
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(updateEqMock).toHaveBeenCalledTimes(1);
  });

  it('Gemini-Fehler: null (deutsch rendern), kein Throw', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('quota'));
    const res = await getOrTranslateEventEn(baseEvent());
    expect(res).toBeNull();
  });

  it('kaputtes JSON von Gemini: null', async () => {
    generateContentMock.mockResolvedValueOnce({ text: 'not json' });
    const res = await getOrTranslateEventEn(baseEvent());
    expect(res).toBeNull();
  });
});
