import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { V4Badge } from '@/components/Events/v4/V4Badge';

describe('V4Badge', () => {
  it('renders the children as label', () => {
    render(<V4Badge kind="ticket">Tickets verfügbar</V4Badge>);
    expect(screen.getByText('Tickets verfügbar')).toBeInTheDocument();
  });

  it('exposes data-kind for styling/testing introspection', () => {
    const { container } = render(<V4Badge kind="match">Match</V4Badge>);
    const el = container.querySelector('[data-v4-badge]');
    expect(el?.getAttribute('data-kind')).toBe('match');
  });

  it('renders an icon for kinds that have one (ticket)', () => {
    const { container } = render(<V4Badge kind="ticket">x</V4Badge>);
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  });

  it('omits the icon for the neutral "unknown" kind', () => {
    const { container } = render(<V4Badge kind="unknown">x</V4Badge>);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders without crashing for every supported kind', () => {
    const kinds = ['ticket','match','lineup','free','doorsale','inplan','unknown','soldout','today'] as const;
    for (const k of kinds) {
      const { unmount } = render(<V4Badge kind={k}>x</V4Badge>);
      unmount();
    }
  });
});
