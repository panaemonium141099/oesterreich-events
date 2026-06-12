import { describe, it, expect } from 'vitest';
import { buildDraftPrompt, COMPLIANCE_FOOTER } from '@/lib/outreach/draft-prompt';

const base = { orgName: 'Schilchertage', domain: 'schilchertage.at', bundesland: 'Steiermark', events: [] };

describe('buildDraftPrompt', () => {
  it('always names the org + domain + asks for JSON', () => {
    const p = buildDraftPrompt(base);
    expect(p).toContain('Schilchertage');
    expect(p).toContain('schilchertage.at');
    expect(p.toLowerCase()).toContain('json');
  });
  it('frames it as a REACH cooperation (Flyer / Link / Erwähnung)', () => {
    const p = buildDraftPrompt(base).toLowerCase();
    expect(p).toContain('kooperation');
    expect(p).toContain('reichweite');
    expect(p).toMatch(/flyer|aushang|link|erwähnung/);
  });
  it('explicitly forbids asking them to post/list their own events', () => {
    expect(buildDraftPrompt(base).toLowerCase()).toMatch(/nicht.*(posten|listen)/s);
  });
  it('uses linked events only as a trust opener (not as the ask)', () => {
    const p = buildDraftPrompt({ ...base, events: [{ id: '1', title: 'Schilcherfest', url: 'https://lasstreffen.at/x', startDate: '2026-07-01' }] });
    expect(p).toContain('Schilcherfest');
    expect(p.toLowerCase()).toContain('vertrauens-einstieg');
  });
});

describe('COMPLIANCE_FOOTER', () => {
  it('carries the opt-out + Impressum (§107 compliance)', () => {
    expect(COMPLIANCE_FOOTER.toLowerCase()).toContain('impressum');
    expect(COMPLIANCE_FOOTER.toLowerCase()).toMatch(/kein interesse|melde mich nicht/);
  });
});
