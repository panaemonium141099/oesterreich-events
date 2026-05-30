import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { V4SideBox } from '@/components/Events/v4/V4SideBox';

describe('V4SideBox dispatcher', () => {
  function probe(boxAttr: string) {
    return document.querySelector(`[data-v4-side-box="${boxAttr}"]`);
  }

  it('state=ticket → V4TicketBox', () => {
    render(<V4SideBox eventId="test-id" state="ticket" provider="Eventim" priceFrom="€ 10" ticketUrl="x"/>);
    expect(probe('ticket')).toBeTruthy();
  });

  it('state=match → V4TicketBox match variant', () => {
    render(<V4SideBox eventId="test-id" state="match" provider="Eventim" priceFrom="€ 10" ticketUrl="x" artistName="Bilderbuch"/>);
    expect(probe('match')).toBeTruthy();
  });

  it('state=lineup → V4TicketBox lineup variant', () => {
    render(<V4SideBox eventId="test-id" state="lineup" provider="Eventim" priceFrom="€ 10" ticketUrl="x" artistName="Wanda"/>);
    expect(probe('lineup')).toBeTruthy();
  });

  it('state=free → V4FreeBox', () => {
    render(<V4SideBox eventId="test-id" state="free"/>);
    expect(probe('free')).toBeTruthy();
  });

  it('state=doorsale → V4DoorsaleBox', () => {
    render(<V4SideBox eventId="test-id" state="doorsale"/>);
    expect(probe('doorsale')).toBeTruthy();
  });

  it('state=inplan → V4InPlanBox', () => {
    render(<V4SideBox eventId="test-id" state="inplan"/>);
    expect(probe('inplan')).toBeTruthy();
  });

  it('state=unknown → V4UnknownBox', () => {
    render(<V4SideBox eventId="test-id" state="unknown"/>);
    expect(probe('unknown')).toBeTruthy();
  });

  it('state=soldout → V4SoldoutBox', () => {
    render(<V4SideBox eventId="test-id" state="soldout"/>);
    expect(probe('soldout')).toBeTruthy();
  });

  it('state=ticket WITHOUT ticketUrl falls back to UnknownBox (safety)', () => {
    render(<V4SideBox eventId="test-id" state="ticket"/>);
    expect(probe('unknown')).toBeTruthy();
  });
});
