import { describe, it, expect } from 'vitest';
import { deriveEventState, type DeriveCtx } from '@/lib/v4/derive-event-state';
import type { Event } from '@/types/events';

function emptyCtx(): DeriveCtx {
  return {
    savedEventIds: new Set(),
    followedArtistIds: new Set(),
    artistMatchEventIds: new Set(),
    lineupMatchEventIds: new Set(),
  };
}

function baseEvent(over: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    source_id: null,
    source_name: null,
    source_url: null,
    title: 't',
    description: null,
    start_date: '2026-06-01',
    end_date: null,
    location_name: null,
    address: null,
    postal_code: null,
    bundesland: null,
    district: null,
    latitude: null,
    longitude: null,
    category: null,
    price_text: null,
    price_min: null,
    price_max: null,
    image_url: null,
    organizer: null,
    tags: null,
    ticket_url: null,
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('deriveEventState', () => {
  it('expired event always returns unknown (safety)', () => {
    const ev = baseEvent({ publish_status: 'expired', ticket_url: 'x' });
    expect(deriveEventState(ev, emptyCtx())).toBe('unknown');
  });

  it('inplan wins when event is in savedEventIds', () => {
    const ev = baseEvent({ id: 'e1', source_name: 'Eventim', ticket_url: 'x', price_tier: 'mittel' });
    const ctx = emptyCtx(); ctx.savedEventIds.add('e1');
    expect(deriveEventState(ev, ctx)).toBe('inplan');
  });

  it('match wins over ticket when event is in artistMatchEventIds', () => {
    const ev = baseEvent({ id: 'e1', source_name: 'Eventim', ticket_url: 'x', price_tier: 'mittel' });
    const ctx = emptyCtx(); ctx.artistMatchEventIds.add('e1');
    expect(deriveEventState(ev, ctx)).toBe('match');
  });

  it('lineup wins over ticket when event is in lineupMatchEventIds (but loses to match)', () => {
    const ev = baseEvent({ id: 'e1', source_name: 'Eventim', ticket_url: 'x', price_tier: 'mittel' });
    const ctx = emptyCtx(); ctx.lineupMatchEventIds.add('e1');
    expect(deriveEventState(ev, ctx)).toBe('lineup');
  });

  it('match wins when both match and lineup are present', () => {
    const ev = baseEvent({ id: 'e1' });
    const ctx = emptyCtx();
    ctx.artistMatchEventIds.add('e1');
    ctx.lineupMatchEventIds.add('e1');
    expect(deriveEventState(ev, ctx)).toBe('match');
  });

  it('ticket — Eventim source + ticket_url (availability is encoded in the feed link)', () => {
    expect(deriveEventState(baseEvent({ source_name: 'Eventim', ticket_url: 'x' }), emptyCtx())).toBe('ticket');
    // price_tier is irrelevant for Eventim — bookability is the ticket_url presence
    expect(deriveEventState(baseEvent({ source_name: 'Eventim', ticket_url: 'x', price_tier: 'unbekannt' }), emptyCtx())).toBe('ticket');
  });

  it('NOT ticket for non-Eventim sources, even with ticket_url + priced (buy button is Eventim-only)', () => {
    expect(deriveEventState(baseEvent({ source_name: 'ntry.at', ticket_url: 'x', price_tier: 'mittel' }), emptyCtx())).toBe('unknown');
    expect(deriveEventState(baseEvent({ source_name: null, ticket_url: 'x', price_tier: 'premium' }), emptyCtx())).toBe('unknown');
  });

  it('NOT ticket for Eventim without ticket_url (sold out / not bookable)', () => {
    expect(deriveEventState(baseEvent({ source_name: 'Eventim', ticket_url: null }), emptyCtx())).toBe('unknown');
  });

  it('free via price_tier=gratis', () => {
    expect(deriveEventState(baseEvent({ price_tier: 'gratis' }), emptyCtx())).toBe('free');
  });

  it('free via price_flags ∋ freier-eintritt', () => {
    expect(deriveEventState(baseEvent({ price_flags: ['freier-eintritt'] }), emptyCtx())).toBe('free');
  });

  it('free via price_flags ∋ spende-erbeten', () => {
    expect(deriveEventState(baseEvent({ price_flags: ['spende-erbeten'] }), emptyCtx())).toBe('free');
  });

  it('doorsale via price_flags ∋ abendkasse', () => {
    expect(deriveEventState(baseEvent({ price_flags: ['abendkasse'] }), emptyCtx())).toBe('doorsale');
  });

  it('free wins over doorsale (both flags present — paradox case)', () => {
    expect(deriveEventState(baseEvent({ price_flags: ['freier-eintritt', 'abendkasse'] }), emptyCtx())).toBe('free');
  });

  it('unknown — price_tier=unbekannt and no flags', () => {
    expect(deriveEventState(baseEvent({ price_tier: 'unbekannt' }), emptyCtx())).toBe('unknown');
  });

  it('unknown — null price_tier and no relevant flags', () => {
    expect(deriveEventState(baseEvent({}), emptyCtx())).toBe('unknown');
  });

  it('inplan beats match (user-action signal wins over follow-derived)', () => {
    const ev = baseEvent({ id: 'e1' });
    const ctx = emptyCtx();
    ctx.savedEventIds.add('e1');
    ctx.artistMatchEventIds.add('e1');
    expect(deriveEventState(ev, ctx)).toBe('inplan');
  });
});
