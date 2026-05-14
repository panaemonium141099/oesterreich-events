import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4InPlanBox } from '@/components/Events/v4/V4InPlanBox';

describe('V4InPlanBox', () => {
  it('shows in-plan badge and "Plan öffnen" CTA', () => {
    render(<V4InPlanBox/>);
    expect(document.querySelector('[data-v4-badge][data-kind="inplan"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: /plan öffnen/i })).toBeInTheDocument();
  });

  it('CTA links to /saved (Phase 3 stub)', () => {
    render(<V4InPlanBox/>);
    expect(screen.getByRole('link', { name: /plan öffnen/i }).getAttribute('href')).toBe('/saved');
  });
});
