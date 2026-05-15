import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4MapHeader } from '@/components/Map/v4/V4MapHeader';

describe('V4MapHeader', () => {
  it('renders eyebrow and H1', () => {
    render(<V4MapHeader />);
    expect(screen.getByRole('heading', { level: 1, name: /events auf der karte/i })).toBeInTheDocument();
  });
});
