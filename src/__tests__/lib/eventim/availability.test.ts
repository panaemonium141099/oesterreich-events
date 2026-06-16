import { describe, it, expect } from 'vitest';
import { isBookable, isCancelled, priceText } from '@/lib/eventim/availability';

const ev = (over: Record<string, unknown> = {}) => ({
  eventStatus: '2',
  deliverable: true,
  priceCategories: [{ inventory: 'buchbar' }],
  ...over,
}) as any;

describe('isBookable', () => {
  it('true: status 2 + deliverable + a buchbar price cat', () => {
    expect(isBookable(ev())).toBe(true);
  });
  it('false when status != 2 (sold out)', () => {
    expect(isBookable(ev({ eventStatus: '4' }))).toBe(false);
  });
  it('false when not deliverable', () => {
    expect(isBookable(ev({ deliverable: false }))).toBe(false);
  });
  it('false when no price cat is buchbar', () => {
    expect(isBookable(ev({ priceCategories: [{ inventory: 'nicht buchbar' }] }))).toBe(false);
  });
  it('false when price cats missing', () => {
    expect(isBookable(ev({ priceCategories: undefined }))).toBe(false);
  });
});

describe('isCancelled', () => {
  it('detects status 1', () => {
    expect(isCancelled(ev({ eventStatus: '1' }))).toBe(true);
    expect(isCancelled(ev())).toBe(false);
  });
});

describe('priceText', () => {
  it('formats a range', () => {
    expect(priceText(41, 59)).toBe('41,00 € – 59,00 €');
  });
  it('collapses equal min/max', () => {
    expect(priceText(10, 10)).toBe('10,00 €');
  });
  it('handles a single bound', () => {
    expect(priceText(undefined, 25)).toBe('25,00 €');
    expect(priceText(15, undefined)).toBe('15,00 €');
  });
  it('undefined when no price', () => {
    expect(priceText(undefined, undefined)).toBeUndefined();
  });
});
