import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4Logo } from '@/components/Layout/v4/V4Logo';

describe('V4Logo', () => {
  it('renders the three text parts of the wordmark', () => {
    render(<V4Logo />);
    expect(screen.getByText('lass')).toBeInTheDocument();
    expect(screen.getByText('treffen')).toBeInTheDocument();
    expect(screen.getByText('at')).toBeInTheDocument();
  });

  it('treffen is the bold emphasis part', () => {
    render(<V4Logo />);
    const treffen = screen.getByText('treffen');
    // font-weight 800 baked into inline styles (extra-bold)
    expect(treffen.style.fontWeight).toBe('800');
  });

  it('lass and at are regular weight', () => {
    render(<V4Logo />);
    expect(screen.getByText('lass').style.fontWeight).toBe('400');
    expect(screen.getByText('at').style.fontWeight).toBe('400');
  });

  it('renders the inline pin SVG between treffen and at', () => {
    const { container } = render(<V4Logo />);
    const svg = container.querySelector('svg[data-v4-logo-pin]');
    expect(svg).toBeTruthy();
    // Pin uses warm accent red #c8553d (LT_PIN from design bundle)
    const path = svg?.querySelector('path');
    expect(path?.getAttribute('fill')).toBe('#c8553d');
  });

  it('size="sm" renders smaller font than default md', () => {
    const { rerender, container } = render(<V4Logo size="md" />);
    const md = container.firstChild as HTMLElement;
    const mdSize = md.style.fontSize;
    rerender(<V4Logo size="sm" />);
    const sm = container.firstChild as HTMLElement;
    expect(sm.style.fontSize).not.toBe(mdSize);
  });
});
