import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4Stepper } from '@/components/Events/v4/V4Stepper';

describe('V4Stepper', () => {
  it('renders all step labels', () => {
    render(<V4Stepper current={1} steps={['Wann', 'Events', 'Notiz']}/>);
    expect(screen.getByText('Wann')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Notiz')).toBeInTheDocument();
  });

  it('marks current step active via data-active', () => {
    const { container } = render(<V4Stepper current={2} steps={['A', 'B', 'C']}/>);
    const activeStep = container.querySelector('[data-step="2"]');
    expect(activeStep?.getAttribute('data-active')).toBe('true');
  });
});
