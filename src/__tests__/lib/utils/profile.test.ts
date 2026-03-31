import { describe, it, expect } from 'vitest';
import { isProfileComplete } from '@/lib/utils/profile';

describe('isProfileComplete', () => {
  it('returns true for a complete profile', () => {
    expect(isProfileComplete({
      first_name: 'Max',
      last_name: 'Mustermann',
      birth_date: '1990-01-15',
    })).toBe(true);
  });

  it('returns false for null profile', () => {
    expect(isProfileComplete(null)).toBe(false);
  });

  it('returns false when first_name is missing', () => {
    expect(isProfileComplete({
      last_name: 'Mustermann',
      birth_date: '1990-01-15',
    })).toBe(false);
  });

  it('returns false when last_name is missing', () => {
    expect(isProfileComplete({
      first_name: 'Max',
      birth_date: '1990-01-15',
    })).toBe(false);
  });

  it('returns false when birth_date is missing', () => {
    expect(isProfileComplete({
      first_name: 'Max',
      last_name: 'Mustermann',
    })).toBe(false);
  });

  it('returns false when first_name is null', () => {
    expect(isProfileComplete({
      first_name: null,
      last_name: 'Mustermann',
      birth_date: '1990-01-15',
    })).toBe(false);
  });

  it('returns false when last_name is null', () => {
    expect(isProfileComplete({
      first_name: 'Max',
      last_name: null,
      birth_date: '1990-01-15',
    })).toBe(false);
  });

  it('returns false when birth_date is null', () => {
    expect(isProfileComplete({
      first_name: 'Max',
      last_name: 'Mustermann',
      birth_date: null,
    })).toBe(false);
  });

  it('returns false when first_name is empty string', () => {
    expect(isProfileComplete({
      first_name: '',
      last_name: 'Mustermann',
      birth_date: '1990-01-15',
    })).toBe(false);
  });

  it('returns false when first_name is whitespace only', () => {
    expect(isProfileComplete({
      first_name: '   ',
      last_name: 'Mustermann',
      birth_date: '1990-01-15',
    })).toBe(false);
  });

  it('returns false when last_name is whitespace only', () => {
    expect(isProfileComplete({
      first_name: 'Max',
      last_name: '  ',
      birth_date: '1990-01-15',
    })).toBe(false);
  });

  it('returns true with trimmed names that have content', () => {
    expect(isProfileComplete({
      first_name: ' Max ',
      last_name: ' Mustermann ',
      birth_date: '1990-01-15',
    })).toBe(true);
  });

  it('returns false for empty object', () => {
    expect(isProfileComplete({})).toBe(false);
  });
});
