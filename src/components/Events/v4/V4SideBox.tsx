/**
 * V4SideBox — routes per-state to the correct side-box variant.
 *
 * Phase 3 fallback rule: if state=ticket/match/lineup but ticketUrl is
 * missing, we degrade to UnknownBox to avoid rendering a primary CTA
 * without a destination. State-derivation in Phase 2 normally prevents
 * this combo, but defensive code keeps the contract safe.
 */

import type { V4EventState } from '@/lib/v4/derive-event-state';
import { V4TicketBox, type V4TicketBoxVariant } from './V4TicketBox';
import { V4FreeBox } from './V4FreeBox';
import { V4DoorsaleBox } from './V4DoorsaleBox';
import { V4InPlanBox } from './V4InPlanBox';
import { V4UnknownBox } from './V4UnknownBox';
import { V4SoldoutBox } from './V4SoldoutBox';

interface V4SideBoxProps {
  /** UUID of the event — propagated to every variant so the "Merken"
   *  button can toggle saved_events. Without this every save link is a
   *  no-op `<a href="/saved">` placeholder, which is what shipped originally. */
  eventId: string;
  state: V4EventState;
  provider?: string;
  priceFrom?: string;
  ticketUrl?: string;
  priceAtDoor?: string;
  artistName?: string;
  mapsUrl?: string;
  /** True when coords exist but are too approximate to route to (town-center
   *  fallback etc.). Side-boxes show an "Ortsangabe ungefähr" pill instead
   *  of the Route link. mapsUrl will be undefined in this case. */
  locationApprox?: boolean;
  onPlanClick?: () => void;
  /** Raw `event.price_text` + numeric range from the row — used by the
   *  planning-state side-boxes (Free, Unknown) to render a labelled
   *  PriceBlock. The ticket-state boxes consume `priceFrom`/`priceAtDoor`
   *  instead and don't need this fanout. */
  priceText?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  priceTier?: 'gratis' | 'günstig' | 'mittel' | 'premium' | 'unbekannt' | null;
}

export function V4SideBox(props: V4SideBoxProps) {
  const { eventId, state, provider, priceFrom, ticketUrl, priceAtDoor, artistName, mapsUrl, locationApprox, onPlanClick,
    priceText, priceMin, priceMax, priceTier } = props;

  // Variants of TicketBox.
  if (state === 'ticket' || state === 'match' || state === 'lineup') {
    if (!provider || !priceFrom || !ticketUrl) {
      return <V4UnknownBox eventId={eventId} mapsUrl={mapsUrl} locationApprox={locationApprox} onPlanClick={onPlanClick} priceText={priceText} priceMin={priceMin} priceMax={priceMax} priceTier={priceTier}/>;
    }
    return (
      <V4TicketBox
        eventId={eventId}
        provider={provider}
        priceFrom={priceFrom}
        ticketUrl={ticketUrl}
        variant={state as V4TicketBoxVariant}
        artistName={artistName}
        onPlanClick={onPlanClick}
      />
    );
  }

  if (state === 'free')     return <V4FreeBox eventId={eventId} onPlanClick={onPlanClick} mapsUrl={mapsUrl} locationApprox={locationApprox} priceText={priceText} priceMin={priceMin} priceMax={priceMax}/>;
  if (state === 'doorsale') return <V4DoorsaleBox eventId={eventId} priceAtDoor={priceAtDoor} mapsUrl={mapsUrl} locationApprox={locationApprox} onPlanClick={onPlanClick}/>;
  if (state === 'inplan')   return <V4InPlanBox onPlanClick={onPlanClick}/>;
  if (state === 'soldout')  return <V4SoldoutBox/>;
  return <V4UnknownBox eventId={eventId} mapsUrl={mapsUrl} locationApprox={locationApprox} onPlanClick={onPlanClick} priceText={priceText} priceMin={priceMin} priceMax={priceMax} priceTier={priceTier}/>;
}
