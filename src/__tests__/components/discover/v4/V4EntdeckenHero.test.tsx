import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EntdeckenHero } from '@/components/Discover/v4/V4EntdeckenHero';

describe('V4EntdeckenHero', () => {
  it('renders eyebrow + headline + sub', () => {
    render(<V4EntdeckenHero mode="list" onModeChange={vi.fn()}/>);
    expect(screen.getByText(/entdecken/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('mounts V4EntdeckenTabs', () => {
    render(<V4EntdeckenHero mode="list" onModeChange={vi.fn()}/>);
    expect(screen.getByRole('tab', { name: /liste/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /smart-suche/i })).toBeInTheDocument();
  });
});
