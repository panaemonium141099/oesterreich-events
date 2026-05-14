import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4ArtistsHero } from '@/components/Artists/v4/V4ArtistsHero';

describe('V4ArtistsHero', () => {
  it('renders eyebrow + headline + subtitle', () => {
    render(<V4ArtistsHero/>);
    expect(screen.getByText(/lieblingskünstler · such & folge/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/konzerte, open airs und festival-slots/i)).toBeInTheDocument();
  });

  it('headline contains "Such einen Künstler"', () => {
    render(<V4ArtistsHero/>);
    expect(screen.getByText(/such einen künstler/i)).toBeInTheDocument();
  });
});
