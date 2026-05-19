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
  state: V4EventState;
  provider?: string;
  priceFrom?: string;
  ticketUrl?: string;
  priceAtDoor?: string;
  artistName?: string;
  mapsUrl?: string;
  onPlanClick?: () => void;
}

export function V4SideBox(props: V4SideBoxProps) {
  const { state, provider, priceFrom, ticketUrl, priceAtDoor, artistName, mapsUrl, onPlanClick } = props;

  // Variants of TicketBox.
  if (state === 'ticket' || state === 'match' || state === 'lineup') {
    if (!provider || !priceFrom || !ticketUrl) {
      return <V4UnknownBox mapsUrl={mapsUrl} onPlanClick={onPlanClick}/>;
    }
    return (
      <V4TicketBox
        provider={provider}
        priceFrom={priceFrom}
        ticketUrl={ticketUrl}
        variant={state as V4TicketBoxVariant}
        artistName={artistName}
        onPlanClick={onPlanClick}
      />
    );
  }

  if (state === 'free')     return <V4FreeBox onPlanClick={onPlanClick} mapsUrl={mapsUrl}/>;
  if (state === 'doorsale') return <V4DoorsaleBox priceAtDoor={priceAtDoor} mapsUrl={mapsUrl} onPlanClick={onPlanClick}/>;
  if (state === 'inplan')   return <V4InPlanBox onPlanClick={onPlanClick}/>;
  if (state === 'soldout')  return <V4SoldoutBox/>;
  return <V4UnknownBox mapsUrl={mapsUrl} onPlanClick={onPlanClick}/>;
}
