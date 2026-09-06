import { describe, it, expect } from 'vitest';
import { buildEventRow, type ApprovableSubmission } from '@/lib/inserate/approve';

const NOW = new Date('2026-06-01T12:00:00Z');

function submission(overrides: Partial<ApprovableSubmission> = {}): ApprovableSubmission {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    title: 'Sommerfest im Schlosspark',
    description: 'Ein Fest mit Blasmusik, Buffet und Feuerwerk zum Abschluss.',
    category: 'Märkte & Feste',
    start_date: '2026-07-15T17:00:00.000Z',
    end_date: null,
    is_all_day: false,
    location_name: 'Schlosspark Esterházy',
    address: 'Esterhazyplatz 5',
    postal_code: '7000',
    bundesland: 'burgenland',
    price_text: 'Eintritt frei',
    ticket_url: null,
    image_url: 'https://musterdorf.at/fest.jpg',
    event_url: 'https://musterdorf.at/sommerfest',
    organizer: 'Musikverein Musterdorf',
    submitter_type: 'company',
    company: 'Musikverein Musterdorf',
    contact_name: 'Max Mustermann',
    ...overrides,
  };
}

describe('buildEventRow', () => {
  it('veröffentlicht das freigegebene Inserat', () => {
    const row = buildEventRow(submission(), { now: NOW });
    expect(row.publish_status).toBe('published');
    expect(row.visibility).toBe('public');
  });

  it('setzt einen quality_score, damit der nächtliche Backfill die Zeile nicht neu bewertet', () => {
    // backfill-quality.ts greift ausschliesslich `quality_score IS NULL`.
    // Ein gesetzter Wert hält die manuelle Freigabe stabil.
    const row = buildEventRow(submission(), { now: NOW });
    expect(typeof row.quality_score).toBe('number');
    expect(row.quality_score).toBeGreaterThan(0);
  });

  it('bleibt auch ohne Bild und ohne Links auf published', () => {
    // Der additive Score würde eine solche Zeile unter die
    // published-Schwelle drücken; die menschliche Freigabe sticht.
    const row = buildEventRow(
      submission({ image_url: null, event_url: null, ticket_url: null, description: null }),
      { now: NOW },
    );
    expect(row.publish_status).toBe('published');
  });

  it('markiert Firmen-Inserate als business und Privatpersonen als user', () => {
    // /admin/moderation filtert genau auf diese beiden Typen.
    expect(buildEventRow(submission(), { now: NOW }).source_type).toBe('business');
    expect(
      buildEventRow(submission({ submitter_type: 'person' }), { now: NOW }).source_type,
    ).toBe('user');
  });

  it('weist die Quelle aus — Pflicht auf jeder Event-Detailseite', () => {
    const row = buildEventRow(submission(), { now: NOW });
    expect(row.source_name).toBe('Musikverein Musterdorf');
    expect(row.source_url).toBe('https://musterdorf.at/sommerfest');
  });

  it('verweist über source_id zurück auf die Einreichung', () => {
    const row = buildEventRow(submission(), { now: NOW });
    expect(row.source_id).toBe('inserat:11111111-2222-3333-4444-555555555555');
  });

  it('übernimmt die durchgereichten Koordinaten', () => {
    const row = buildEventRow(submission(), {
      now: NOW,
      latitude: 47.8457,
      longitude: 16.5236,
    });
    expect(row.latitude).toBe(47.8457);
    expect(row.longitude).toBe(16.5236);
  });

  it('gibt ein Event ohne auflösbare Koordinaten trotzdem frei', () => {
    const row = buildEventRow(submission(), { now: NOW });
    expect(row.latitude).toBeNull();
    expect(row.publish_status).toBe('published');
  });

  it('leitet ein fehlendes Bundesland aus der PLZ ab', () => {
    const row = buildEventRow(submission({ bundesland: null }), { now: NOW });
    expect(row.bundesland).toBe('burgenland');
  });

  it('lässt die Angabe des Inserenten der PLZ-Ableitung vorgehen', () => {
    const row = buildEventRow(
      submission({ bundesland: 'wien', postal_code: '7000' }),
      { now: NOW },
    );
    expect(row.bundesland).toBe('wien');
  });

  it('erzeugt einen Slug aus Titel und Ort', () => {
    const row = buildEventRow(submission(), { now: NOW });
    expect(row.slug).toBe('sommerfest-im-schlosspark-schlosspark-esterhazy');
  });

  it('setzt last_seen_at auf den Freigabezeitpunkt', () => {
    const row = buildEventRow(submission(), { now: NOW });
    expect(row.last_seen_at).toBe(NOW.toISOString());
  });

  it('fällt auf Sonstiges zurück, wenn keine Kategorie gesetzt ist', () => {
    const row = buildEventRow(submission({ category: null }), { now: NOW });
    expect(row.category).toBe('Sonstiges');
  });
});
