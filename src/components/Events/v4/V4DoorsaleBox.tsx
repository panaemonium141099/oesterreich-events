/**
 * V4DoorsaleBox — side-box when state === 'doorsale'.
 *
 * Telegraphs "no online presale — buy at the door". Optional priceAtDoor
 * prop renders a small "vor Ort: €X" block. Blue accent (doorsale token).
 */

import { V4Badge } from './V4Badge';

interface V4DoorsaleBoxProps {
  priceAtDoor?: string;
  onPlanClick?: () => void;
  /** Google-Maps-Directions-URL für die "Route"-Aktion. Ohne sie wird
   *  der Route-Button durch ein einzelnes "Merken"-Icon ersetzt. */
  mapsUrl?: string;
  /** True when coords exist but are too approximate to route to. Renders a
   *  non-clickable "Ortsangabe ungefähr" pill in the Route slot instead. */
  locationApprox?: boolean;
}

export function V4DoorsaleBox({ priceAtDoor, onPlanClick, mapsUrl, locationApprox }: V4DoorsaleBoxProps) {
  const showsLocationCell = !!mapsUrl || !!locationApprox;
  return (
    <div
      data-v4-side-box="doorsale"
      className="rounded-[18px] overflow-hidden bg-[var(--v4-surface-elevated)]"
      style={{ border: '1px solid rgba(126,170,240,0.34)' }}
    >
      <div className="h-[3px]" style={{ background: '#7eaaf0' }}/>
      <div className="p-[20px_22px_22px]">
        <V4Badge kind="doorsale">Abendkasse</V4Badge>
        <p className="mt-3.5 text-[16px] font-semibold text-[var(--v4-ink)] tracking-[-0.015em] leading-tight">
          Tickets gibt&apos;s nur vor Ort — kein Online-Verkauf.
        </p>

        {priceAtDoor && (
          <div
            className="mt-3 rounded-[10px] px-3.5 py-2.5 flex items-baseline gap-2 border border-[var(--v4-hairline-2)] bg-[var(--v4-surface)]"
          >
            <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[var(--v4-ink-50)]">vor Ort</span>
            <span className="text-[17px] font-bold tracking-[-0.015em] text-[var(--v4-ink)]">{priceAtDoor}</span>
          </div>
        )}

        <p className="mt-3 text-[12.5px] text-[var(--v4-ink-50)] leading-[1.5]">
          Plane Anreise und Reminder — wir erinnern dich rechtzeitig.
        </p>

        {onPlanClick ? (
          <button
            type="button"
            onClick={onPlanClick}
            data-track="plan_started"
            className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
          >
            Abend planen
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        ) : (
          <a
            href="/saved"
            data-track="plan_started"
            className="press-haptic mt-[18px] flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full bg-[var(--v4-ink)] text-[#0a0a0c] text-sm font-semibold"
          >
            Abend planen
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
          </a>
        )}

        <div className="mt-2.5 flex gap-2">
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-track="route_opened"
              className="press-haptic flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[12.5px] font-semibold text-[var(--v4-ink)]"
            >
              Route
            </a>
          ) : locationApprox ? (
            <span
              title="Beim Veranstalter die genaue Adresse pruefen, bevor du losfaehrst."
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-dashed border-[var(--v4-hairline-3)] text-[11.5px] font-medium text-[var(--v4-ink-50)] cursor-help"
            >
              Ortsangabe ungefähr
            </span>
          ) : null}
          <a
            href="/saved"
            className={`press-haptic inline-flex items-center justify-center px-3 py-2 rounded-full border border-[var(--v4-hairline-3)] text-[var(--v4-ink)] ${showsLocationCell ? '' : 'flex-1 gap-1.5 text-[12.5px] font-semibold'}`}
            aria-label="Merken"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            {!showsLocationCell && <span>Merken</span>}
          </a>
        </div>
      </div>
    </div>
  );
}
