import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EntdeckenHero } from '@/components/Discover/v4/V4EntdeckenHero';

describe('V4EntdeckenHero', () => {
  it('renders eyebrow + headline + sub', () => {
    render(<V4EntdeckenHero/>);
    expect(screen.getByText(/entdecken/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
});
