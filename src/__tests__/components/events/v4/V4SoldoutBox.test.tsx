import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4SoldoutBox } from '@/components/Events/v4/V4SoldoutBox';

describe('V4SoldoutBox', () => {
  it('shows soldout badge in red tone', () => {
    render(<V4SoldoutBox/>);
    expect(document.querySelector('[data-v4-badge][data-kind="soldout"]')).toBeTruthy();
  });

  it('headline conveys sold-out status', () => {
    render(<V4SoldoutBox/>);
    expect(screen.getByText(/aktuell vergriffen/i)).toBeInTheDocument();
  });

  it('CTA scrolls to similar-events anchor', () => {
    render(<V4SoldoutBox/>);
    expect(screen.getByRole('link', { name: /ähnliche events/i }).getAttribute('href')).toBe('#similar-events');
  });
});
