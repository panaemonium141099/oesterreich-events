import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4PlanWizard } from '@/components/Plans/v4/V4PlanWizard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ events: [] }) }));

describe('V4PlanWizard', () => {
  it('opens on Step 1 with name + date fields', () => {
    render(<V4PlanWizard mode="page"/>);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/datum/i)).toBeInTheDocument();
  });

  it('renders Stepper progressbar', () => {
    render(<V4PlanWizard mode="page"/>);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
