'use client';

/**
 * V4EntdeckenSmartMode — der Smart-Tab von /entdecken.
 *
 * Seit 2026-10-23 eine Freitext-Suche mit visueller Antwort
 * (V4SmartPlanner, Variante A aus docs/design/smart-planer): ein Textfeld
 * in Alltagssprache, Verstanden-Chips, Poster-Regale, Plan-Leiste. Der
 * frühere Concierge-Chat (fn-19) ist als API unter /api/search/chat
 * weiterhin vorhanden, die Oberfläche nutzt ihn nicht mehr.
 */

import { V4SmartPlanner } from './V4SmartPlanner';

interface V4EntdeckenSmartModeProps {
  initialQuery?: string;
}

export function V4EntdeckenSmartMode({ initialQuery = '' }: V4EntdeckenSmartModeProps) {
  return <V4SmartPlanner initialQuery={initialQuery}/>;
}
