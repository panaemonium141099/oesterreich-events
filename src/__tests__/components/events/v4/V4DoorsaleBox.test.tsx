import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4DoorsaleBox } from '@/components/Events/v4/V4DoorsaleBox';

describe('V4DoorsaleBox', () => {
  it('shows doorsale badge + no-online-presale headline', () => {
    render(<V4DoorsaleBox eventId="test-id"/>);
    expect(document.querySelector('[data-v4-badge][data-kind="doorsale"]')).toBeTruthy();
    expect(screen.getByText(/nur vor ort/i)).toBeInTheDocument();
  });

  it('renders priceAtDoor block when prop present', () => {
    render(<V4DoorsaleBox eventId="test-id" priceAtDoor="€ 15"/>);
    expect(screen.getByText('€ 15')).toBeInTheDocument();
    expect(screen.getAllByText(/vor ort/i).length).toBeGreaterThan(0);
  });

  it('omits price block when no priceAtDoor', () => {
    const { container } = render(<V4DoorsaleBox eventId="test-id"/>);
    expect(container.textContent).not.toMatch(/€ \d+/);
  });
});
