import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4FreeBox } from '@/components/Events/v4/V4FreeBox';

describe('V4FreeBox', () => {
  it('shows free badge + headline + plan-CTA', () => {
    render(<V4FreeBox/>);
    expect(document.querySelector('[data-v4-badge][data-kind="free"]')).toBeTruthy();
    expect(screen.getByText(/plane deinen abend/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abend planen/i })).toBeInTheDocument();
  });

  it('plan-CTA points to /saved (Phase-3 stub for Plan Wizard route)', () => {
    render(<V4FreeBox/>);
    expect(screen.getByRole('link', { name: /abend planen/i }).getAttribute('href')).toBe('/saved');
  });

  it('does NOT render ticket trust-copy', () => {
    render(<V4FreeBox/>);
    expect(screen.queryByText(/kauf und zahlung/i)).toBeNull();
  });
});
