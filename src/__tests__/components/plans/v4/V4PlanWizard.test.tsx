import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4PlanWizard } from '@/components/Plans/v4/V4PlanWizard';
import type { Event } from '@/types/events';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) }));

const sampleEvent: Event = {
  id: 'evt-1',
  source_type: 'test',
  source_id: 't1',
  source_name: 'Test',
  source_url: 'https://example.com',
  title: 'Bilderbuch Live',
  description: null,
  start_date: '2026-06-15T20:00:00.000Z',
  end_date: null,
  location_name: 'Wiener Stadthalle',
  address: 'Roland-Rainer-Platz 1',
  postal_code: '1150',
  bundesland: 'wien',
  district: null,
  latitude: null,
  longitude: null,
  category: 'concerts',
  price_text: null,
  price_min: null,
  price_max: null,
  image_url: null,
  organizer: null,
  tags: null,
  created_at: '2026-05-15T00:00:00.000Z',
  updated_at: '2026-05-15T00:00:00.000Z',
};

describe('V4PlanWizard', () => {
  it('starts at Step 0 (event picker) when no initialEvent', () => {
    render(<V4PlanWizard mode="page"/>);
    expect(screen.getByText('Welches Event?')).toBeInTheDocument();
    expect(screen.getByText('Weiter zu Tickets')).toBeInTheDocument();
  });

  it('starts at Step 1 (Tickets) with Stepper when initialEvent is given', () => {
    render(<V4PlanWizard mode="page" initialEvent={sampleEvent}/>);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/Schritt 01 · Tickets/i)).toBeInTheDocument();
  });

  it('renders all 5 designer step labels in the Stepper', () => {
    render(<V4PlanWizard mode="page" initialEvent={sampleEvent}/>);
    expect(screen.getByText('Tickets')).toBeInTheDocument();
    expect(screen.getByText('Anreise')).toBeInTheDocument();
    expect(screen.getByText('Unterkunft')).toBeInTheDocument();
    expect(screen.getByText('Reminder')).toBeInTheDocument();
    expect(screen.getByText('Übersicht')).toBeInTheDocument();
  });
});
