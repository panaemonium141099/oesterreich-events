import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4PlanCard } from '@/components/Plans/v4/V4PlanCard';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    <a href={href}>{children}</a>,
}));

describe('V4PlanCard', () => {
  const plan = {
    id: 'p1', user_id: 'u1', name: 'Wochenend-Plan',
    plan_date: '2026-06-15', note: null, visibility: 'private' as const,
    created_at: '2026-05-15', updated_at: '2026-05-15',
  };

  it('renders plan name and date', () => {
    render(<V4PlanCard plan={plan} eventCount={3}/>);
    expect(screen.getByText('Wochenend-Plan')).toBeInTheDocument();
    expect(screen.getByText(/3 events/i)).toBeInTheDocument();
  });

  it('links to plan detail', () => {
    render(<V4PlanCard plan={plan} eventCount={0}/>);
    const link = screen.getByText('Wochenend-Plan').closest('a');
    expect(link?.getAttribute('href')).toBe('/plan/p1');
  });
});
