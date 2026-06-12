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
  it('uses the warm "zurückverlinken" angle when events are linked', () => {
    const p = buildDraftPrompt({ ...base, events: [{ id: '1', title: 'Schilcherfest', url: 'https://lasstreffen.at/events/x', startDate: '2026-07-01' }] });
    expect(p).toContain('Schilcherfest');
    expect(p).toContain('https://lasstreffen.at/events/x');
    expect(p.toLowerCase()).toContain('zurückverlink');
  });
  it('uses the softer "listen lassen" angle when no events', () => {
    const p = buildDraftPrompt(base);
    expect(p.toLowerCase()).toContain('listen');
  });
});

describe('COMPLIANCE_FOOTER', () => {
  it('carries the opt-out + Impressum (§107 compliance)', () => {
    expect(COMPLIANCE_FOOTER.toLowerCase()).toContain('impressum');
    expect(COMPLIANCE_FOOTER.toLowerCase()).toMatch(/kein interesse|melde mich nicht/);
  });
});
