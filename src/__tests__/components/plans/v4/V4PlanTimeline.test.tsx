import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4PlanTimeline } from '@/components/Plans/v4/V4PlanTimeline';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));
vi.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { src, alt, fill, sizes, ...rest } = props as Record<string, unknown>;
    return <img src={String(src)} alt={String(alt)} {...rest as object}/>;
  },
}));

describe('V4PlanTimeline', () => {
  it('renders empty state when no events', () => {
    render(<V4PlanTimeline events={[]}/>);
    expect(screen.getByText(/noch keine events/i)).toBeInTheDocument();
  });

  it('renders event titles', () => {
    const events = [
      { id: 'e1', title: 'Konzert A', start_date: '2026-06-15T20:00:00Z', location_name: 'Stadthalle', image_url: null } as never,
      { id: 'e2', title: 'Konzert B', start_date: '2026-06-15T22:00:00Z', location_name: null, image_url: null } as never,
    ];
    render(<V4PlanTimeline events={events}/>);
    expect(screen.getAllByText('Konzert A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Konzert B').length).toBeGreaterThan(0);
  });
});
