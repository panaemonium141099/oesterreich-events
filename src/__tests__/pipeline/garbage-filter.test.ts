import { describe, it, expect } from 'vitest';
import { isGarbageTitle } from '@/lib/pipeline/garbage-filter';

describe('isGarbageTitle: Badge-Leiste statt Titel', () => {
  it('verwirft "Event" + Umbruch + Genre (partytimer-Kartentext)', () => {
    expect(isGarbageTitle('Event\n           Pop / Rock\n           Arsen')).toBe(true);
    expect(isGarbageTitle('Event\r\n Party')).toBe(true);
    expect(isGarbageTitle('Event')).toBe(true);
  });

  it('lässt echte Titel mit "Event" am Anfang durch', () => {
    expect(isGarbageTitle('Event Horizon Festival')).toBe(false);
    expect(isGarbageTitle('Eventnacht im Flex')).toBe(false);
    expect(isGarbageTitle('Klub66')).toBe(false);
  });
});
