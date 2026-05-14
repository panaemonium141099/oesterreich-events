import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FilterChips, FILTER_CHIPS } from '@/components/Events/v4/V4FilterChips';

describe('V4FilterChips', () => {
  it('exports the 9 canonical chips', () => {
    const keys = FILTER_CHIPS.map(c => c.key);
    expect(keys).toEqual(['tickets','free','doorsale','today','weekend','concerts','festivals','nearby','mine']);
  });

  it('renders all 9 chip buttons', () => {
    render(<V4FilterChips active={new Set()} onToggle={() => {}}/>);
    expect(screen.getByRole('button', { name: /tickets verfügbar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gratis/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /meine künstler/i })).toBeInTheDocument();
  });

  it('marks active chip with data-active=true', () => {
    render(<V4FilterChips active={new Set(['tickets'])} onToggle={() => {}}/>);
    expect(screen.getByRole('button', { name: /tickets verfügbar/i }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('button', { name: /gratis/i }).getAttribute('data-active')).toBe('false');
  });

  it('calls onToggle with chip key on click', () => {
    const onToggle = vi.fn();
    render(<V4FilterChips active={new Set()} onToggle={onToggle}/>);
    screen.getByRole('button', { name: /tickets verfügbar/i }).click();
    expect(onToggle).toHaveBeenCalledWith('tickets');
  });
});
