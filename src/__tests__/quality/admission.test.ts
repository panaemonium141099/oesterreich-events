/**
 * Regressionstests für den zentralen Freigabevertrag.
 *
 * Die Fälle stammen 1:1 aus der Tabelle "Für die Implementierung
 * notwendige Regressionstests" des Pipeline-Audits vom 2026-09-06,
 * ergänzt um die drei dort offline reproduzierten Gegenbeispiele.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateAdmission,
  hasTimeOfDay,
  isEndBeforeStart,
  hasForeignPlaceSignal,
  viennaCalendarDay,
} from '@/lib/quality/admission';
import { scoreAndAdmit } from '@/lib/quality/score-event';

/** Fixer "Jetzt"-Zeitpunkt, damit die Tests nicht mit der Uhr altern. */
const NOW = new Date('2026-09-06T10:00:00Z');
const FUTURE = '2026-10-01T19:00:00+02:00';

/** Minimal-Event, das durchgeht — Basis für die Negativfälle. */
const OK = {
  title: 'Konzert im Musikheim',
  start_date: FUTURE,
  location_name: 'Musikheim Oberwart',
  postal_code: '7400',
  bundesland: 'burgenland',
  country: 'AT',
  latitude: 47.2917,
  longitude: 16.2033,
};

describe('evaluateAdmission — Basis', () => {
  it('lässt ein vollständiges Event durch', () => {
    expect(evaluateAdmission(OK, { now: NOW })).toMatchObject({
      decision: 'admit',
      reasons: [],
      corrections: [],
    });
  });
});

// ─── Zeit ───────────────────────────────────────────────────────────

describe('Zeitintervalle', () => {
  it('Beginn 18:00, Ende 17:00 am selben Tag → zurückweisen', () => {
    const v = evaluateAdmission(
      { ...OK, start_date: '2026-10-01T18:00:00+02:00', end_date: '2026-10-01T17:00:00+02:00' },
      { now: NOW },
    );
    expect(v.decision).toBe('reject');
    expect(v.reasons).toContain('end_before_start');
  });

  it('Ende nur als Kalendertag (Platzhalter-Mitternacht) → kein Fehlalarm', () => {
    // Der mit Abstand häufigste Fall im Bestand: Start mit Uhrzeit,
    // Ende als reines Datum. Darf NICHT als "Ende vor Beginn" gelten.
    const v = evaluateAdmission(
      { ...OK, start_date: '2026-10-01T18:00:00+02:00', end_date: '2026-10-01T00:00:00Z' },
      { now: NOW },
    );
    expect(v.decision).toBe('admit');
  });

  it('mehrtägiges Event mit datums-only-Ende bleibt gültig', () => {
    const v = evaluateAdmission(
      { ...OK, start_date: '2026-10-01T18:00:00+02:00', end_date: '2026-10-03T00:00:00Z' },
      { now: NOW },
    );
    expect(v.decision).toBe('admit');
  });

  it('Ende einen Kalendertag vor Beginn → zurückweisen', () => {
    const v = evaluateAdmission(
      { ...OK, start_date: '2026-10-05T18:00:00+02:00', end_date: '2026-10-01T00:00:00Z' },
      { now: NOW },
    );
    expect(v.reasons).toContain('end_before_start');
  });

  it('unparsbares Enddatum → zurückweisen', () => {
    const v = evaluateAdmission({ ...OK, end_date: 'demnächst' }, { now: NOW });
    expect(v.reasons).toContain('invalid_end_date');
  });

  it('vergangenes Event → zurückweisen, heute bleibt gültig', () => {
    expect(
      evaluateAdmission({ ...OK, start_date: '2026-09-05T19:00:00+02:00' }, { now: NOW }).reasons,
    ).toContain('start_in_past');
    expect(
      evaluateAdmission({ ...OK, start_date: '2026-09-06T19:00:00+02:00' }, { now: NOW }).decision,
    ).toBe('admit');
  });

  it('fehlender Titel / fehlendes Datum → zurückweisen', () => {
    expect(evaluateAdmission({ ...OK, title: '   ' }, { now: NOW }).reasons).toContain('missing_title');
    expect(evaluateAdmission({ ...OK, start_date: null }, { now: NOW }).reasons).toContain(
      'missing_start_date',
    );
  });
});

describe('hasTimeOfDay — Platzhalter-Mitternacht erkennen', () => {
  it('erkennt beide Platzhalter-Formen unabhängig von der Schreibweise', () => {
    // Genau hier lag der Datums-Score-Bug: endsWith('T00:00:00') griff bei
    // der Z-Schreibweise nicht, derselbe Kalendertag bekam 8 statt 13 Punkte.
    expect(hasTimeOfDay('2026-10-01T00:00:00Z')).toBe(false);
    expect(hasTimeOfDay('2026-10-01T00:00:00')).toBe(false);
    expect(hasTimeOfDay('2026-10-01T22:00:00Z')).toBe(false); // Wien-Mitternacht (Sommer)
    expect(hasTimeOfDay('2026-12-01T23:00:00Z')).toBe(false); // Wien-Mitternacht (Winter)
  });

  it('erkennt echte Uhrzeiten', () => {
    expect(hasTimeOfDay('2026-10-01T19:00:00+02:00')).toBe(true);
    expect(hasTimeOfDay('2026-10-01T17:00:00Z')).toBe(true);
  });

  it('ist robust gegen Müll', () => {
    expect(hasTimeOfDay(null)).toBe(false);
    expect(hasTimeOfDay('irgendwann')).toBe(false);
  });
});

describe('Sommer-/Winterzeit', () => {
  it('rechnet Kalendertage in Wien-Ortszeit, nicht in UTC', () => {
    // 2026-10-01T22:30Z ist in Wien bereits der 2. Oktober (Sommerzeit, +02:00).
    expect(viennaCalendarDay(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02');
    // Nach der Umstellung (Winterzeit, +01:00) ist 23:30Z der Folgetag.
    expect(viennaCalendarDay(new Date('2026-11-01T23:30:00Z'))).toBe('2026-11-02');
    expect(viennaCalendarDay(new Date('2026-11-01T22:30:00Z'))).toBe('2026-11-01');
  });

  it('vergleicht über den Zeitumstellungs-Sprung korrekt', () => {
    // Umstellung 2026-10-25 03:00 → 02:00 Wien. Ein Event, das über die
    // Umstellung läuft, endet später als es beginnt — trotz kleinerer Uhrzeit.
    expect(isEndBeforeStart('2026-10-25T02:30:00+02:00', '2026-10-25T02:30:00+01:00')).toBe(false);
  });
});

// ─── Ort ────────────────────────────────────────────────────────────

describe('Ortsangaben', () => {
  it('Event mit vielen Feldern, aber ohne Ort → keine Freigabe', () => {
    // Audit §2A: dieser Datensatz erreichte Score 65 und damit `published`,
    // weil Bild, Text und Links die fehlende Kerninformation kompensierten.
    const v = evaluateAdmission(
      {
        title: 'Grosses Sommerfest mit Live-Musik',
        start_date: FUTURE,
        location_name: null,
        address: null,
        postal_code: null,
        latitude: null,
        longitude: null,
      },
      { now: NOW },
    );
    expect(v.decision).toBe('quarantine');
    expect(v.reasons).toContain('no_location_evidence');
  });

  it('Platzhalter-Ortsname zählt nicht als Ort', () => {
    for (const name of ['Österreich', 'Austria', 'online', 'TBA', 'Unbekannt', '-']) {
      const v = evaluateAdmission(
        { title: 'X', start_date: FUTURE, location_name: name, address: null, postal_code: null },
        { now: NOW },
      );
      expect(v.decision, name).toBe('quarantine');
      expect(v.reasons, name).toContain('placeholder_location');
    }
  });

  it('Platzhalter-Ortsname wird auch mit angehängter Koordinate nicht freigegeben', () => {
    // Der Master-Coord-Eintrag "österreich" → 48.3069/14.2858 (Linz) hat
    // per DB-Trigger jedem so befüllten Event einen Linzer Pin verpasst.
    const v = evaluateAdmission(
      { title: 'Dumpling Fest Des Moines', start_date: FUTURE, location_name: 'Österreich', latitude: 48.3069, longitude: 14.2858 },
      { now: NOW },
    );
    expect(v.decision).toBe('quarantine');
    expect(v.reasons).toContain('placeholder_location');
  });

  it('echter Ortsname mit Adresse bleibt zulässig', () => {
    const v = evaluateAdmission(
      { ...OK, location_name: 'Hauptplatz', address: 'Hauptplatz 1', postal_code: '7400' },
      { now: NOW },
    );
    expect(v.decision).toBe('admit');
  });
});

describe('Widersprüche', () => {
  it('country=AT, Koordinate ausserhalb Österreichs → keine Freigabe', () => {
    const v = evaluateAdmission(
      { ...OK, latitude: 52.52, longitude: 13.405, country: 'AT' }, // Berlin
      { now: NOW },
    );
    expect(v.decision).toBe('quarantine');
    expect(v.reasons).toContain('coords_outside_declared_country');
  });

  it('country=DE mit deutscher Koordinate ist kein Widerspruch', () => {
    const v = evaluateAdmission(
      { ...OK, latitude: 52.52, longitude: 13.405, country: 'DE', bundesland: null },
      { now: NOW },
    );
    expect(v.decision).toBe('admit');
  });

  it('unauflösbarer Widerspruch zwischen Bundesland und Koordinate → keine Freigabe', () => {
    // Ohne dritte Stimme (keine PLZ-Auflösung) bleibt offen, welche der
    // beiden Angaben falsch ist — also wird nicht geraten.
    const v = evaluateAdmission(
      { ...OK, postal_code: null, bundesland: 'kaernten', latitude: 48.3069, longitude: 14.2858 },
      { now: NOW, regionOf: () => 'oberoesterreich' },
    );
    expect(v.decision).toBe('quarantine');
    expect(v.reasons).toContain('region_contradicts_coords');
    expect(v.corrections).toEqual([]);
  });

  it('PLZ sagt eine dritte Region → ebenfalls keine Freigabe', () => {
    const v = evaluateAdmission(
      { ...OK, postal_code: '1010', bundesland: 'kaernten', latitude: 48.3069, longitude: 14.2858 },
      { now: NOW, regionOf: () => 'oberoesterreich', plzRegionOf: () => 'wien' },
    );
    expect(v.decision).toBe('quarantine');
    expect(v.reasons).toContain('region_contradicts_coords');
  });

  it('PLZ stützt das Bundesland → Koordinate verwerfen, Event bleibt freigegeben', () => {
    // Der häufigste Fall im Bestand (124 von 161): ein generischer Ortsname
    // ("Haus", "Platz", "Hauptplatz") wurde auf ein gleichnamiges Dorf in
    // einem anderen Bundesland aufgelöst. Das Event ist echt und liegt dort,
    // wo PLZ und Bundesland sagen — nur der Kartenpin ist falsch.
    const v = evaluateAdmission(
      { ...OK, postal_code: '8230', bundesland: 'steiermark', latitude: 48.23279, longitude: 13.99847 },
      { now: NOW, regionOf: () => 'oberoesterreich', plzRegionOf: () => 'steiermark' },
    );
    expect(v.decision).toBe('admit');
    expect(v.corrections).toEqual(['drop_coordinates']);
  });

  it('PLZ stützt die Koordinate → Bundesland korrigieren, Event bleibt freigegeben', () => {
    // "Micheldorf in Oberösterreich" stand auf bundesland='kaernten'
    // (es gibt auch ein Micheldorf in Kärnten) — hier ist das Label falsch.
    const v = evaluateAdmission(
      { ...OK, postal_code: '4563', bundesland: 'kaernten', latitude: 47.88228, longitude: 14.1334 },
      { now: NOW, regionOf: () => 'oberoesterreich', plzRegionOf: () => 'oberoesterreich' },
    );
    expect(v.decision).toBe('admit');
    expect(v.corrections).toEqual(['use_coordinate_region']);
    expect(v.correctedBundesland).toBe('oberoesterreich');
  });

  it('eine verworfene Zeile trägt keine Korrekturen — sie wird gar nicht geschrieben', () => {
    const v = evaluateAdmission(
      {
        ...OK,
        start_date: '2026-10-01T18:00:00+02:00',
        end_date: '2026-10-01T17:00:00+02:00',
        postal_code: '8230',
        bundesland: 'steiermark',
        latitude: 48.23279,
        longitude: 13.99847,
      },
      { now: NOW, regionOf: () => 'oberoesterreich', plzRegionOf: () => 'steiermark' },
    );
    expect(v.decision).toBe('reject');
    expect(v.corrections).toEqual([]);
  });

  it('kein Polygon-Treffer → keine Behauptung statt Rateschluss', () => {
    const v = evaluateAdmission(OK, { now: NOW, regionOf: () => null });
    expect(v.decision).toBe('admit');
  });

  it('ohne regionOf-Auflösung entfällt die Gegenprobe still', () => {
    expect(evaluateAdmission({ ...OK, bundesland: 'kaernten' }, { now: NOW }).decision).toBe('admit');
  });
});

describe('hasForeignPlaceSignal', () => {
  it('erkennt US-/CA-Endsegmente', () => {
    expect(hasForeignPlaceSignal('Portsmouth Square, San Francisco, CA')).toBe(true);
    expect(hasForeignPlaceSignal('123 Main St, Chandler, AZ 85224')).toBe(true);
    expect(hasForeignPlaceSignal('40 Bay St, Toronto, ON')).toBe(true);
  });

  it('schlägt bei österreichischen Adressen nicht an', () => {
    expect(hasForeignPlaceSignal('Hauptplatz 1, Oberwart')).toBe(false);
    expect(hasForeignPlaceSignal('Wien, Österreich')).toBe(false);
    expect(hasForeignPlaceSignal('Musikheim')).toBe(false);
    // "DE" ist im DACH-Kontext ein Länderkürzel, kein Delaware.
    expect(hasForeignPlaceSignal('Berlin, DE')).toBe(false);
  });

  it('quarantänisiert ein als AT deklariertes Event mit US-Adresse', () => {
    const v = evaluateAdmission(
      { ...OK, location_name: 'Portsmouth Square, San Francisco, CA', latitude: null, longitude: null },
      { now: NOW },
    );
    expect(v.decision).toBe('quarantine');
    expect(v.reasons).toContain('foreign_place_signal');
  });
});

// ─── scoreAndAdmit: Korrekturen wirken auf den geschriebenen Zustand ──

describe('scoreAndAdmit', () => {
  it('verworfene Koordinate zählt nicht mehr für den Score', () => {
    const event = {
      title: 'Silvesterparty in Hartberg',
      description: 'x'.repeat(250),
      start_date: FUTURE,
      location_name: 'Hauptplatz, Hartberg',
      address: 'Hauptplatz 1',
      postal_code: '8230',
      bundesland: 'steiermark',
      country: 'AT',
      latitude: 48.23279,
      longitude: 13.99847,
      category: 'Party',
      image_url: 'https://example.at/i.jpg',
      source_url: 'https://example.at/e',
    };
    const r = scoreAndAdmit(event, {
      now: NOW,
      regionOf: () => 'oberoesterreich',
      plzRegionOf: () => 'steiermark',
    });

    expect(r.corrected.latitude).toBeNull();
    expect(r.corrected.longitude).toBeNull();
    // Das Event bleibt sichtbar — nur der falsche Pin ist weg.
    expect(['published', 'published_low_confidence']).toContain(r.publish_status);
    // Der Score darf keine Koordinaten-Punkte mehr enthalten (7 + 5 in-AT).
    expect(r.breakdown.location).toBe(13); // address 5 + name 3 + plz&bundesland 5
  });

  it('korrigiertes Bundesland landet im zu schreibenden Zustand', () => {
    const r = scoreAndAdmit(
      {
        title: 'Spielgruppe Rasselbande',
        start_date: FUTURE,
        location_name: 'Micheldorf in Oberösterreich',
        postal_code: '4563',
        bundesland: 'kaernten',
        country: 'AT',
        latitude: 47.88228,
        longitude: 14.1334,
      },
      { now: NOW, regionOf: () => 'oberoesterreich', plzRegionOf: () => 'oberoesterreich' },
    );
    expect(r.corrected.bundesland).toBe('oberoesterreich');
    expect(r.corrected.latitude).toBe(47.88228);
  });

  it('erzwingt needs_review bei Quarantäne, egal wie hoch der Score ist', () => {
    // Audit §2A: genau dieser Datensatz erreichte Score 65 → published.
    const r = scoreAndAdmit(
      {
        title: 'Grosses Sommerfest mit Live-Musik',
        description: 'x'.repeat(250),
        start_date: FUTURE,
        category: 'Party',
        image_url: 'https://example.at/i.jpg',
        source_url: 'https://example.at/e',
        ticket_url: 'https://oeticket.com/x',
      },
      { now: NOW },
    );
    expect(r.quality_score).toBeGreaterThanOrEqual(60);
    expect(r.publish_status).toBe('needs_review');
    expect(r.admission.reasons).toContain('no_location_evidence');
  });
});
