'use client';

/**
 * V4EntdeckenSmartMode — der Smart-Tab von /entdecken.
 *
 * Seit dem fn-19-Rework ist das EIN durchgehender Concierge-Chat
 * (V4SmartChat): eine Eingabe für Erstfrage und Follow-ups, Antworten
 * mit Entity-Karten aus der DB, Timeline-Auswahl → Plan.
 *
 * Der frühere Aufbau (Suchleiste → Semantic-Grid + separates
 * Chat-Panel) wurde nach User-Feedback zusammengelegt; die Listen-
 * Ansicht mit allen Treffern bleibt im Listen-Tab. /api/search/semantic
 * bleibt als API bestehen (Engine unter den Chat-Tools).
 */

import { V4SmartChat } from './V4SmartChat';

interface V4EntdeckenSmartModeProps {
  initialQuery?: string;
}

export function V4EntdeckenSmartMode({ initialQuery = '' }: V4EntdeckenSmartModeProps) {
  return <V4SmartChat initialQuery={initialQuery}/>;
}
