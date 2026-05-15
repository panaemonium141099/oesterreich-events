import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4MarkerLegend } from '@/components/Map/v4/V4MarkerLegend';

describe('V4MarkerLegend', () => {
  it('shows all 4 marker categories as text labels', () => {
    render(<V4MarkerLegend />);
    expect(screen.getByText(/tickets verfügbar/i)).toBeInTheDocument();
    expect(screen.getByText(/künstler im line-up/i)).toBeInTheDocument();
    expect(screen.getByText(/in deinem plan/i)).toBeInTheDocument();
    expect(screen.getByText(/kein online-verkauf/i)).toBeInTheDocument();
  });
});
