import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4UnknownBox } from '@/components/Events/v4/V4UnknownBox';

describe('V4UnknownBox', () => {
  it('shows unknown badge', () => {
    render(<V4UnknownBox/>);
    expect(document.querySelector('[data-v4-badge][data-kind="unknown"]')).toBeTruthy();
  });

  it('headline mentions no-known-shop messaging', () => {
    render(<V4UnknownBox/>);
    expect(screen.getByText(/kein.*ticketshop/i)).toBeInTheDocument();
  });

  it('offers Merken + Route as primary actions', () => {
    render(<V4UnknownBox/>);
    expect(screen.getByRole('link', { name: /merken/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /route/i })).toBeInTheDocument();
  });
});
