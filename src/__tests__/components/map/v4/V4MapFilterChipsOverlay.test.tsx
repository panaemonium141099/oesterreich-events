import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4MapFilterChipsOverlay } from '@/components/Map/v4/V4MapFilterChipsOverlay';

describe('V4MapFilterChipsOverlay', () => {
  it('renders 4 essential map chips', () => {
    render(<V4MapFilterChipsOverlay active={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /tickets verfügbar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gratis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /heute/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /konzerte/i })).toBeInTheDocument();
  });

  it('toggling chip calls onToggle with key', () => {
    const onToggle = vi.fn();
    render(<V4MapFilterChipsOverlay active={new Set()} onToggle={onToggle} />);
    screen.getByRole('button', { name: /tickets verfügbar/i }).click();
    expect(onToggle).toHaveBeenCalledWith('tickets');
  });
});
