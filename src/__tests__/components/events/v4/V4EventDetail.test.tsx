import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EventDetail } from '@/components/Events/v4/V4EventDetail';
import type { Event } from '@/types/events';

vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, priority, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} {...rest as object}/>;
  },
}));

function ev(over: Partial<Event> = {}): Event {
  return {
    id: 'e1', source_id: null, source_name: null, source_url: null,
    title: 'Bilderbuch', description: 'Eines der größten Konzerte',
    start_date: '2026-09-15T20:00:00Z', end_date: null,
    location_name: 'Stadthalle', address: null, postal_code: null,
    bundesland: 'Wien', district: null,
    latitude: null, longitude: null,
    category: 'music', price_text: null, price_min: null, price_max: null,
    image_url: 'https://cdn.example/hero.jpg',
    organizer: null, tags: ['rock', 'austropop'],
    ticket_url: 'https://eventim.at/x',
    slug: 'bilderbuch', created_at: '', updated_at: '',
    ...over,
  };
}

describe('V4EventDetail', () => {
  it('renders hero + content + side-box', () => {
    render(<V4EventDetail event={ev()} state="ticket" provider="Eventim" priceFrom="€ 48"/>);
    expect(screen.getByRole('heading', { level: 1, name: /bilderbuch/i })).toBeInTheDocument();
    expect(screen.getByText(/eines der größten konzerte/i)).toBeInTheDocument();
    expect(document.querySelector('[data-v4-side-box="ticket"]')).toBeTruthy();
  });

  it('mounts mobile sticky bar', () => {
    render(<V4EventDetail event={ev()} state="ticket" provider="Eventim" priceFrom="€ 48"/>);
    expect(document.querySelector('[data-v4-event-sticky="ticket"]')).toBeTruthy();
  });

  it('renders state=free without provider', () => {
    render(<V4EventDetail event={ev({ ticket_url: null })} state="free"/>);
    expect(document.querySelector('[data-v4-side-box="free"]')).toBeTruthy();
  });
});
