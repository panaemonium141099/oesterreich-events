/**
 * Nächtliche Nachprüfung des Freigabevertrags im Bestand. Fälle aus dem
 * ersten Dry-Run gegen Prod (2026-10-17): verwaiste Müll- und Sprechtag-
 * Termine ohne Quellenstand und Gutscheine mit 31.12.2037, die keine Quelle
 * mehr liefert.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateAdmission,
  NON_LOCATION_REASONS,
  titleTimeQuarantineReasons,
} from '@/lib/quality/admission';
import { planRecheckRow, protocolWith, type RecheckRow } from '@/lib/quality/admission-recheck';
import { underlyingStatus } from '@/lib/pipeline/dedup-cluster';

const NOW = new Date('2026-10-17T10:00:00Z');
const SOON = '2026-11-04T18:00:00.000Z';
const FAR = '2037-12-30T23:00:00.000Z';

const row = (over: Partial<RecheckRow> = {}): RecheckRow => ({
  id: 'ev-1',
  title: 'Konzert im Musikheim',
  start_date: SOON,
  publish_status: 'published',
  quality_score: 72,
  location_status: 'address_confirmed',
  reasons: [],
  ...over,
});

describe('titleTimeQuarantineReasons: dieselben Gründe wie der Vertrag', () => {
  it('liefert nur Gründe ohne Ortsbezug', () => {
    for (const r of titleTimeQuarantineReasons({ title: 'Biomüll', start_date: FAR }, NOW)) {
      expect(NON_LOCATION_REASONS.has(r)).toBe(true);
    }
  });

  it('stimmt mit evaluateAdmission überein', () => {
    for (const input of [
      { title: 'Biomüll', start_date: SOON },
      { title: 'Tierpfleger im Zoo', start_date: FAR },
      { title: 'Sperrmüll- und Problemstoffsammlung', start_date: FAR },
      { title: 'Konzert im Musikheim', start_date: SOON },
    ]) {
      const verdict = evaluateAdmission({ ...input, location_name: 'Musikheim', latitude: 47.3, longitude: 16.2 }, { now: NOW });
      const fromContract = verdict.reasons.filter(r => NON_LOCATION_REASONS.has(r));
      expect(titleTimeQuarantineReasons(input, NOW), input.title).toEqual(fromContract);
    }
  });
});

describe('planRecheckRow: halten', () => {
  it('verwaister Müll-Termin, sichtbar → needs_review mit Grund', () => {
    expect(planRecheckRow(row({ title: 'Biomüll' }), NOW)).toEqual({
      id: 'ev-1', action: 'hold', publish_status: 'needs_review', added: ['municipal_service'], removed: [],
    });
  });

  it('Gutschein 31.12.2037, sichtbar → needs_review mit Horizont-Grund', () => {
    const c = planRecheckRow(row({ title: 'Tierpfleger im Zoo', start_date: FAR, publish_status: 'published_low_confidence' }), NOW);
    expect(c?.action).toBe('hold');
    expect(c?.added).toEqual(['start_too_far_ahead']);
  });

  it('normale Zeile bleibt unberührt', () => {
    expect(planRecheckRow(row(), NOW)).toBeNull();
  });

  it('Duplikate und zurückgezogene Zeilen fasst die Nachprüfung nicht an', () => {
    expect(planRecheckRow(row({ title: 'Biomüll', publish_status: 'duplicate' }), NOW)).toBeNull();
    expect(planRecheckRow(row({ title: 'Biomüll', publish_status: 'suppressed' }), NOW)).toBeNull();
  });
});

describe('planRecheckRow: Rücknahme, wenn der Grund entfällt', () => {
  const held = (over: Partial<RecheckRow> = {}) =>
    row({ publish_status: 'needs_review', reasons: ['gemeinde_centroid_from_plz', 'admission:municipal_service'], ...over });

  it('Grund trifft nicht mehr zu (Regel zurückgenommen) → Status aus dem Score', () => {
    expect(planRecheckRow(held(), NOW)).toEqual({
      id: 'ev-1', action: 'release', publish_status: 'published', added: [], removed: ['municipal_service'],
    });
  });

  it('Termin in den Horizont gerückt → frei', () => {
    const c = planRecheckRow(held({ start_date: '2029-06-01T18:00:00.000Z', reasons: ['admission:start_too_far_ahead'] }), NOW);
    expect(c?.action).toBe('release');
    expect(c?.removed).toEqual(['start_too_far_ahead']);
  });

  it('Score allein reicht nicht für sichtbar → nur Protokoll', () => {
    expect(planRecheckRow(held({ quality_score: 30 }), NOW)?.action).toBe('protocol');
    expect(planRecheckRow(held({ quality_score: null }), NOW)?.action).toBe('protocol');
  });

  it('anderer Haltegrund bleibt → nur Protokoll', () => {
    expect(planRecheckRow(held({ location_status: 'conflict' }), NOW)?.action).toBe('protocol');
    expect(planRecheckRow(held({ reasons: ['admission:municipal_service', 'admission:no_location_evidence'] }), NOW)?.action).toBe('protocol');
    expect(planRecheckRow(held({ reasons: ['admission:municipal_service', 'raw_persist_failed'] }), NOW)?.action).toBe('protocol');
  });

  it('Grund trifft zu, fehlt aber im Protokoll → eintragen, Status bleibt', () => {
    expect(planRecheckRow(row({ title: 'Biomüll', publish_status: 'needs_review', reasons: [] }), NOW)).toEqual({
      id: 'ev-1', action: 'protocol', added: ['municipal_service'], removed: [],
    });
  });

  it('Grund trifft zu und steht im Protokoll → nichts zu tun', () => {
    expect(planRecheckRow(held({ title: 'Biomüll' }), NOW)).toBeNull();
  });
});

describe('protocolWith', () => {
  const NOW_ISO = NOW.toISOString();

  it('trägt den Grund ein und lässt die Ortsentscheidung stehen', () => {
    const lr = {
      input_hash: 'abc',
      status: 'address_confirmed',
      reasons: ['gemeinde_centroid_from_plz'],
      evidence: ['bundesland:source:noe'],
      admission: { decision: 'admit', reasons: [], corrections: [] },
    };
    const out = protocolWith(lr, { added: ['municipal_service'], removed: [] }, NOW_ISO);
    expect(out.input_hash).toBe('abc');
    expect(out.evidence).toEqual(['bundesland:source:noe']);
    expect(out.reasons).toEqual(['gemeinde_centroid_from_plz', 'admission:municipal_service']);
    expect(out.admission).toEqual({ decision: 'quarantine', reasons: ['municipal_service'], corrections: [] });
    expect(out.admission_recheck).toEqual({ at: NOW_ISO, added: ['municipal_service'], removed: [] });
  });

  it('nimmt den Grund wieder heraus, andere Gründe bleiben', () => {
    const lr = {
      reasons: ['admission:municipal_service', 'admission:no_location_evidence'],
      admission: { decision: 'quarantine', reasons: ['municipal_service', 'no_location_evidence'], corrections: [] },
    };
    const out = protocolWith(lr, { added: [], removed: ['municipal_service'] }, NOW_ISO);
    expect(out.reasons).toEqual(['admission:no_location_evidence']);
    expect(out.admission).toEqual({ decision: 'quarantine', reasons: ['no_location_evidence'], corrections: [] });
  });

  it('letzter Grund weg → Vertrag lässt zu', () => {
    const lr = { reasons: ['admission:start_too_far_ahead'], admission: { decision: 'quarantine', reasons: ['start_too_far_ahead'], corrections: [] } };
    expect(protocolWith(lr, { added: [], removed: ['start_too_far_ahead'] }, NOW_ISO).admission?.decision).toBe('admit');
  });

  it('Altbestand ohne Protokoll bekommt Gründe und Vertragsurteil', () => {
    expect(protocolWith(null, { added: ['municipal_service'], removed: [] }, NOW_ISO)).toEqual({
      reasons: ['admission:municipal_service'],
      admission: { decision: 'quarantine', reasons: ['municipal_service'], corrections: [] },
      admission_recheck: { at: NOW_ISO, added: ['municipal_service'], removed: [] },
    });
  });
});

describe('Dedup: Duplikat jenseits des Horizonts wird nicht als Ersatz sichtbar', () => {
  it('underlyingStatus rechnet den Horizont aus dem Termin', () => {
    // Ohne gespeichertes Quarantäne-Urteil (Quelle liefert die Zeile nicht mehr).
    expect(underlyingStatus({ title: 'Tierpfleger im Zoo', start_date: '2037-12-30T23:00:00.000Z', quality_score: 80, admission_decision: 'admit' })).toBe('needs_review');
    expect(underlyingStatus({ title: 'Konzert', start_date: SOON, quality_score: 80, admission_decision: 'admit' })).toBe('published');
  });
});
