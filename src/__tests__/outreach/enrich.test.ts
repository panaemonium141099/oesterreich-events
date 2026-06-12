import { describe, it, expect } from 'vitest';
import { extractEmails, findContactPath } from '@/lib/outreach/enrich';

describe('extractEmails', () => {
  it('pulls mailto + plain-text emails, deduped + lowercased', () => {
    const html = `
      <a href="mailto:Office@Verein.at">mail</a>
      kontakt: info@verein.at oder office@verein.at
    `;
    expect(extractEmails(html, 'verein.at')).toEqual(['office@verein.at', 'info@verein.at']);
  });
  it('filters asset/tracking junk (icon@2x.png, sentry, example, wixpress)', () => {
    const html = `logo@2x.png a@sentry.io x@example.com y@sentry-next.wixpress.com real@verein.at`;
    expect(extractEmails(html, 'verein.at')).toEqual(['real@verein.at']);
  });
  it('prefers same-domain emails first', () => {
    const html = `fremd@gmail.com chef@verein.at`;
    expect(extractEmails(html, 'verein.at')[0]).toBe('chef@verein.at');
  });
});

describe('findContactPath', () => {
  it('finds impressum / kontakt links', () => {
    const html = `<a href="/ueber">x</a><a href="/impressum">Impressum</a>`;
    expect(findContactPath(html)).toBe('/impressum');
  });
  it('finds by link text when href is opaque', () => {
    const html = `<a href="/p/12">Kontakt</a>`;
    expect(findContactPath(html)).toBe('/p/12');
  });
  it('returns null when none', () => {
    expect(findContactPath('<a href="/news">News</a>')).toBeNull();
  });
});
