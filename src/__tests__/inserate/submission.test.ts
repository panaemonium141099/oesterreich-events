import { describe, it, expect } from 'vitest';
import {
  validateSubmission,
  cleanUrl,
  toInstant,
} from '@/lib/inserate/submission';

/** Referenzzeitpunkt für alle Tests: 1. Juni 2026, 12:00 UTC. */
const NOW = new Date('2026-06-01T12:00:00Z');

/** Minimal gültige Einreichung — einzelne Felder werden pro Test überschrieben. */
function base(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Sommerfest im Schlosspark',
    startDate: '2026-07-15',
    startTime: '19:00',
    submitterType: 'company',
    company: 'Musikverein Musterdorf',
    contactName: 'Max Mustermann',
    email: 'max@musterdorf.at',
    rightsConfirmed: true,
    ...overrides,
  };
}

describe('toInstant', () => {
  it('interpretiert Datum + Uhrzeit als Wiener Ortszeit (Sommerzeit, UTC+2)', () => {
    expect(toInstant('2026-07-15', '19:00')).toBe('2026-07-15T17:00:00.000Z');
  });

  it('interpretiert Datum + Uhrzeit im Winter als UTC+1', () => {
    expect(toInstant('2026-01-15', '19:00')).toBe('2026-01-15T18:00:00.000Z');
  });

  it('setzt ohne Uhrzeit Mitternacht Wiener Zeit an — keine Platzhalter-Uhrzeit', () => {
    // 00:00 Wien im Sommer = 22:00 UTC am Vortag. Entscheidend: der
    // Wiener Kalendertag bleibt der 15.07., nicht der 14.07.
    const instant = toInstant('2026-07-15', null);
    expect(instant).toBe('2026-07-14T22:00:00.000Z');
    const viennaDay = new Date(instant!).toLocaleDateString('de-AT', {
      timeZone: 'Europe/Vienna',
    });
    expect(viennaDay).toContain('15');
  });

  it('lehnt ein unbrauchbares Datum ab', () => {
    expect(toInstant('15.07.2026', '19:00')).toBeNull();
  });
});

describe('cleanUrl', () => {
  it('ergänzt ein fehlendes Schema', () => {
    expect(cleanUrl('www.musterdorf.at')).toBe('https://www.musterdorf.at/');
  });

  it('lässt https durch', () => {
    expect(cleanUrl('https://musterdorf.at/fest')).toBe('https://musterdorf.at/fest');
  });

  it('verwirft javascript:-URLs', () => {
    // Landete sonst ungefiltert in href/src der öffentlichen Detailseite.
    expect(cleanUrl('javascript:alert(1)')).toBeNull();
  });

  it('verwirft data:-URLs', () => {
    expect(cleanUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  it('verwirft Werte ohne Punkt im Hostnamen', () => {
    expect(cleanUrl('localhost')).toBeNull();
  });

  it('macht aus Leerstring null', () => {
    expect(cleanUrl('   ')).toBeNull();
  });
});

describe('validateSubmission — Pflichtfelder', () => {
  it('nimmt eine vollständige Einreichung an', () => {
    const result = validateSubmission(base(), NOW);
    expect(result.ok).toBe(true);
  });

  it('lehnt einen zu kurzen Titel ab', () => {
    const result = validateSubmission(base({ title: 'Ab' }), NOW);
    expect(result).toMatchObject({ ok: false, field: 'title' });
  });

  it('verlangt eine E-Mail-Adresse mit Domain', () => {
    const result = validateSubmission(base({ email: 'max@localhost' }), NOW);
    expect(result).toMatchObject({ ok: false, field: 'email' });
  });

  it('verlangt bei submitterType=company einen Firmennamen', () => {
    const result = validateSubmission(base({ company: '  ' }), NOW);
    expect(result).toMatchObject({ ok: false, field: 'company' });
  });

  it('verlangt bei submitterType=person KEINEN Firmennamen', () => {
    const result = validateSubmission(
      base({ submitterType: 'person', company: '' }),
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  it('verlangt die Rechtebestätigung', () => {
    const result = validateSubmission(base({ rightsConfirmed: false }), NOW);
    expect(result).toMatchObject({ ok: false, field: 'rightsConfirmed' });
  });
});

describe('validateSubmission — Termin', () => {
  it('lehnt einen Termin in der Vergangenheit ab', () => {
    const result = validateSubmission(base({ startDate: '2026-05-01' }), NOW);
    expect(result).toMatchObject({ ok: false, field: 'startDate' });
  });

  it('akzeptiert den laufenden Tag (12-h-Toleranz)', () => {
    // 01.06.2026, 00:00 Wien = 31.05. 22:00 UTC — 14 h vor NOW, aber der
    // Kalendertag läuft noch.
    const result = validateSubmission(
      base({ startDate: '2026-06-01', startTime: '08:00' }),
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  it('lehnt ein Ende vor dem Beginn ab', () => {
    const result = validateSubmission(
      base({ endDate: '2026-07-15', endTime: '17:00' }),
      NOW,
    );
    expect(result).toMatchObject({ ok: false, field: 'endDate' });
  });

  it('akzeptiert ein mehrtägiges Fest', () => {
    const result = validateSubmission(
      base({ endDate: '2026-07-17', endTime: '23:00' }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.end_date).toBe('2026-07-17T21:00:00.000Z');
  });

  it('ignoriert bei isAllDay die Uhrzeiten', () => {
    const result = validateSubmission(
      base({ isAllDay: true, startTime: '19:00' }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.is_all_day).toBe(true);
      expect(result.value.start_date).toBe('2026-07-14T22:00:00.000Z');
    }
  });
});

describe('validateSubmission — Vokabular', () => {
  it('übernimmt eine Kategorie aus der Taxonomie', () => {
    const result = validateSubmission(base({ category: 'Musik' }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.category).toBe('Musik');
  });

  it('ersetzt eine erfundene Kategorie durch Sonstiges', () => {
    // Eine freie Kategorie wäre in keinem Filter und auf keiner
    // Themenseite auffindbar.
    const result = validateSubmission(base({ category: 'Techno-Rave' }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.category).toBe('Sonstiges');
  });

  it('übernimmt ein gültiges Bundesland und normalisiert die Schreibweise', () => {
    const result = validateSubmission(base({ bundesland: 'Burgenland' }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.bundesland).toBe('burgenland');
  });

  it('verwirft ein unbekanntes Bundesland zu null', () => {
    const result = validateSubmission(base({ bundesland: 'Bayern' }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.bundesland).toBeNull();
  });

  it('verwirft eine PLZ, die keine vierstellige Zahl ist', () => {
    const result = validateSubmission(base({ postalCode: 'A-7000' }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.postal_code).toBeNull();
  });
});

describe('validateSubmission — Ableitungen', () => {
  it('setzt den Veranstalter auf die Firma, wenn nicht angegeben', () => {
    const result = validateSubmission(base(), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.organizer).toBe('Musikverein Musterdorf');
  });

  it('fällt bei Privatpersonen auf den Ansprechpartner zurück', () => {
    const result = validateSubmission(
      base({ submitterType: 'person', company: '' }),
      NOW,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.organizer).toBe('Max Mustermann');
  });

  it('verwirft eine unbrauchbare Bild-URL, ohne die Einreichung zu kippen', () => {
    const result = validateSubmission(base({ imageUrl: 'javascript:alert(1)' }), NOW);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.image_url).toBeNull();
  });
});
