/**
 * V4MapHeader — sticky-top v4-style page header above the Mapbox
 * container on /map. Pure RSC.
 */

export function V4MapHeader() {
  return (
    <div className="relative z-10 border-b border-[var(--v4-hairline-1)] bg-[var(--v4-surface)]">
      <div className="max-w-[1180px] mx-auto px-4 md:px-14 py-4 md:py-5">
        <p className="text-[10.5px] uppercase tracking-[0.22em] font-semibold text-[var(--v4-ink-50)] mb-1.5">Karte</p>
        <h1 className="m-0 text-[22px] md:text-[28px] font-bold tracking-[-0.025em] text-[var(--v4-ink)] leading-[1.1]">
          Events auf der Karte.
        </h1>
      </div>
    </div>
  );
}
