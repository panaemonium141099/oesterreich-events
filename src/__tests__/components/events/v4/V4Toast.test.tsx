import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { V4Toast } from '@/components/Events/v4/V4Toast';

describe('V4Toast', () => {
  it('renders children', () => {
    render(<V4Toast>Du folgst jetzt Bilderbuch.</V4Toast>);
    expect(screen.getByText(/du folgst jetzt bilderbuch/i)).toBeInTheDocument();
  });

  it('exposes data-kind for default (match)', () => {
    const { container } = render(<V4Toast>x</V4Toast>);
    const el = container.querySelector('[data-v4-toast]');
    expect(el?.getAttribute('data-kind')).toBe('match');
  });

  it('renders dismiss button that calls onDismiss', () => {
    const onDismiss = vi.fn();
    render(<V4Toast onDismiss={onDismiss}>x</V4Toast>);
    screen.getByRole('button', { name: /schließen/i }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after duration ms', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<V4Toast duration={1000} onDismiss={onDismiss}>x</V4Toast>);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(onDismiss).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('duration=0 means sticky (no auto-dismiss)', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<V4Toast duration={0} onDismiss={onDismiss}>x</V4Toast>);
    act(() => { vi.advanceTimersByTime(60000); });
    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
