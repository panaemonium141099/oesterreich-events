import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4SortRow, SORT_OPTIONS } from '@/components/Events/v4/V4SortRow';

describe('V4SortRow', () => {
  it('exports 4 sort options', () => {
    expect(SORT_OPTIONS.map(s => s.key)).toEqual(['score','date','tickets','distance']);
  });

  it('renders all sort pills', () => {
    render(<V4SortRow current="score" total={120} onChange={() => {}}/>);
    expect(screen.getByText(/empfohlen/i)).toBeInTheDocument();
    expect(screen.getByText(/datum/i)).toBeInTheDocument();
  });

  it('shows total count', () => {
    render(<V4SortRow current="score" total={42} onChange={() => {}}/>);
    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it('marks current pill active via data-active', () => {
    render(<V4SortRow current="date" total={1} onChange={() => {}}/>);
    expect(screen.getByRole('button', { name: /datum/i }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('button', { name: /empfohlen/i }).getAttribute('data-active')).toBe('false');
  });

  it('calls onChange with sort key', () => {
    const onChange = vi.fn();
    render(<V4SortRow current="score" total={1} onChange={onChange}/>);
    screen.getByRole('button', { name: /datum/i }).click();
    expect(onChange).toHaveBeenCalledWith('date');
  });
});
