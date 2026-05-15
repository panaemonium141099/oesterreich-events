import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4EntdeckenTabs } from '@/components/Events/v4/V4EntdeckenTabs';

describe('V4EntdeckenTabs', () => {
  it('renders both tabs (list, smart)', () => {
    render(<V4EntdeckenTabs current="list" onChange={() => {}}/>);
    expect(screen.getByRole('tab', { name: /liste/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /smart-suche/i })).toBeInTheDocument();
  });

  it('marks current tab aria-selected', () => {
    render(<V4EntdeckenTabs current="smart" onChange={() => {}}/>);
    expect(screen.getByRole('tab', { name: /smart-suche/i }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: /liste/i }).getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange with the other mode', () => {
    const onChange = vi.fn();
    render(<V4EntdeckenTabs current="list" onChange={onChange}/>);
    screen.getByRole('tab', { name: /smart-suche/i }).click();
    expect(onChange).toHaveBeenCalledWith('smart');
  });
});
