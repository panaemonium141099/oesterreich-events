import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { V4DatePicker } from '@/components/Events/v4/V4DatePicker';

describe('V4DatePicker', () => {
  it('renders with initial value', () => {
    render(<V4DatePicker value="2026-06-15" onChange={() => {}} label="Datum"/>);
    const input = screen.getByLabelText('Datum') as HTMLInputElement;
    expect(input.value).toBe('2026-06-15');
  });

  it('calls onChange with new ISO date', () => {
    const onChange = vi.fn();
    render(<V4DatePicker value="2026-06-15" onChange={onChange} label="Datum"/>);
    const input = screen.getByLabelText('Datum') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-07-01' } });
    expect(onChange).toHaveBeenCalledWith('2026-07-01');
  });
});
