import Link from 'next/link';

const CITY_DOTS = [
  { x: 180, y: 200, l: 'BREGENZ' },
  { x: 360, y: 200, l: 'SALZBURG' },
  { x: 520, y: 200, l: 'LINZ' },
  { x: 720, y: 215, l: 'WIEN' },
  { x: 800, y: 245, l: 'EISENSTADT' },
  { x: 600, y: 255, l: 'GRAZ' },
];

const EVENT_DOTS = [
  { x: 720, y: 215, r: 8, fill: 'var(--v4-ticket)' },
  { x: 800, y: 245, r: 6, fill: 'var(--v4-match)' },
  { x: 360, y: 200, r: 5, fill: 'var(--v4-ink-70)' },
  { x: 520, y: 200, r: 7, fill: 'var(--v4-ticket)' },
  { x: 600, y: 255, r: 6, fill: 'var(--v4-go)' },
];

export function MapPreview() {
  return (
    <section className="max-w-[1180px] mx-auto px-4 md:px-14 py-6 md:py-10">
      <div className="flex items-end justify-between gap-6 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--v4-ink-50)] mb-2">
            Karte
          </p>
          <h2 className="text-[26px] font-bold leading-tight tracking-[-0.025em] text-[var(--v4-ink)]">
            Events in deiner Nähe
          </h2>
        </div>
        <Link
          href="/map"
          className="hidden md:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--v4-ink-70)]"
        >
          Karte öffnen
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>

      <div className="relative h-[220px] md:h-[320px] rounded-[18px] overflow-hidden border border-[var(--v4-hairline-1)] bg-[var(--v4-surface-elevated)]">
        <svg width="100%" height="100%" viewBox="0 0 1100 320" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, i) => (
            <path key={i}
              d={`M -20 ${60 + i * 38} Q 320 ${48 + i * 38 + (i % 2 ? 14 : -10)} 700 ${66 + i * 38} T 1120 ${56 + i * 38}`}
              fill="none" stroke="var(--v4-hairline-1)" strokeWidth="0.7"/>
          ))}
          <path d="M 80 220 Q 200 160 320 180 Q 460 175 560 195 Q 700 215 820 180 Q 940 160 1020 200 L 1020 270 Q 880 295 740 280 Q 540 260 380 290 Q 220 305 100 290 Z"
            fill="none" stroke="var(--v4-hairline-2)" strokeWidth="1"/>
          {CITY_DOTS.map(c => (
            <g key={c.l}>
              <circle cx={c.x} cy={c.y} r="2" fill="var(--v4-ink-50)"/>
              <text x={c.x + 8} y={c.y + 3} fill="var(--v4-ink-50)" fontSize="9" letterSpacing="2.2" fontWeight={600}>{c.l}</text>
            </g>
          ))}
          {EVENT_DOTS.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={p.r + 6} fill="none" stroke={p.fill} strokeWidth="0.6" opacity="0.4"/>
              <circle cx={p.x} cy={p.y} r={p.r} fill={p.fill}/>
            </g>
          ))}
        </svg>

        <div className="absolute bottom-4 left-4 flex gap-3.5 flex-wrap px-3.5 py-2.5 rounded-xl bg-[rgba(10,10,12,0.85)] backdrop-blur border border-[var(--v4-hairline-2)] text-[11px] text-[var(--v4-ink-70)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v4-ticket)' }} aria-hidden="true"/>
            Tickets verfügbar
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v4-match)' }} aria-hidden="true"/>
            Künstler im Line-up
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--v4-go)' }} aria-hidden="true"/>
            In deinem Plan
          </span>
        </div>

        <Link
          href="/map"
          className="press-haptic absolute top-4 right-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-[12.5px] font-semibold"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
          Karte öffnen
        </Link>
      </div>
    </section>
  );
}
