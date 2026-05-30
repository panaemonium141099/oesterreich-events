import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { V4SideBox } from '@/components/Events/v4/V4SideBox';
import { BANNED_STRINGS } from '@/lib/v4/event-detail-trust-copy';

describe('banned-strings — event detail surfaces', () => {
  const states = ['ticket','match','lineup','free','doorsale','inplan','unknown','soldout'] as const;

  for (const state of states) {
    it(`no banned strings appear in V4SideBox state=${state}`, () => {
      const { container } = render(
        <V4SideBox
          eventId="test-id"
          state={state}
          provider="Eventim"
          priceFrom="€ 10"
          ticketUrl="https://eventim.de/x"
          artistName="Bilderbuch"
        />
      );
      const text = container.textContent ?? '';
      for (const banned of BANNED_STRINGS) {
        expect(text).not.toContain(banned);
      }
    });
  }
});
