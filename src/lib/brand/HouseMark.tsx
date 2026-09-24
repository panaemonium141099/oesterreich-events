/**
 * Bildmarke „Haus mit Wegen": weißes Haus auf rotem Kreis, darunter drei
 * Wege, die vom Haus nach außen laufen (Design: claude.ai/design,
 * „Logo Haus mit Wegen"). Reines Inline-SVG, damit next/og es ohne
 * Asset-Laden zu PNG rendert (Favicon, Apple-Icon, Organization-Logo).
 *
 * Die Koordinaten stammen aus dem Design-Entwurf; die viewBox schneidet
 * genau den Kreis aus, die Wege werden am Kreisrand abgeschnitten.
 */
export const HOUSE_MARK_RED = '#e04a2f';

export function HouseMark({ size }: { size: number }) {
  const stroke = {
    fill: 'none',
    stroke: '#ffffff',
    strokeWidth: 10.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg width={size} height={size} viewBox="46.5 31.5 107 107" style={{ display: 'block' }}>
      <defs>
        <clipPath id="lt-house-clip">
          <circle cx="100" cy="85" r="53.5" />
        </clipPath>
      </defs>
      <circle cx="100" cy="85" r="53.5" fill={HOUSE_MARK_RED} />
      <g clipPath="url(#lt-house-clip)">
        {/* Dach */}
        <path d="M72 82.5 L100.5 57 L129 82.5" {...stroke} />
        {/* Wände + Boden */}
        <path d="M82.5 79 L82.5 99 L118.5 99 L118.5 79" {...stroke} />
        {/* Wege: gerade nach unten und schräg nach links/rechts */}
        <path d="M100.5 99 L100.5 150" {...stroke} strokeLinecap="butt" />
        <path d="M100.5 105 L30.5 148 M100.5 105 L170.5 148" {...stroke} strokeLinecap="butt" />
      </g>
    </svg>
  );
}
