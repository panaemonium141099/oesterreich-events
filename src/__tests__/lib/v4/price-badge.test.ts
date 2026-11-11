import { describe, it, expect } from 'vitest';
import { priceBadge } from '@/lib/v4/price-badge';

const labels = { free: 'Gratis', from: (p: string) => `ab ${p} €` };
const badge = (e: Parameters<typeof priceBadge>[0]) => priceBadge(e, labels);

describe('priceBadge', () => {
  it('zeigt Gratis für Flag, Tier und Nullpreis', () => {
    expect(badge({ price_text: 'gratis', price_min: null, price_max: null })).toBe('Gratis');
    expect(badge({ price_text: 'Eintritt frei', price_min: null, price_max: null })).toBe('Gratis');
    expect(badge({ price_text: null, price_min: null, price_max: null, price_tier: 'gratis' })).toBe('Gratis');
    expect(badge({ price_text: null, price_min: 0, price_max: 0 })).toBe('Gratis');
  });

  it('bildet „ab" nur bei einer Spanne', () => {
    expect(badge({ price_text: null, price_min: 26, price_max: 48 })).toBe('ab 26 €');
    expect(badge({ price_text: null, price_min: 18, price_max: 18 })).toBe('18 €');
    expect(badge({ price_text: null, price_min: 18, price_max: null })).toBe('18 €');
  });

  it('nimmt nur einfache Preistexte', () => {
    expect(badge({ price_text: '15 €', price_min: null, price_max: null })).toBe('15 €');
    expect(badge({ price_text: 'ab 29,50 EUR', price_min: null, price_max: null })).toBe('ab 29,50 €');
    expect(badge({ price_text: 'EUR 79.00 pro Person inkl. Sektbegleitung', price_min: null, price_max: null })).toBeNull();
    expect(badge({ price_text: null, price_min: null, price_max: null })).toBeNull();
  });
});
