'use client';

/**
 * FilterDrawer — single overlay holding every non-search filter.
 *
 * Variante A · Airbnb-clean: white panel, rounded corners, hairline border,
 * "47 Events anzeigen" CTA bottom right. Desktop: centered modal. Mobile:
 * bottom-sheet with drag-handle. ESC + backdrop-click close.
 *
 * Replaces the inline FilterBar's 8 squashed chips. Centralizes:
 *   - Wann (presets + custom range)        — wraps datePresets.applyDatePreset
 *   - Bundesland (chips)                    — replaces the header dropdown
 *   - Bezirk (chips, derived from BL)
 *   - Kategorie (chips with counts, single)
 *   - Distanz (slider, only with location)  — TODO: wires once user-loc plumbed
 *   - Familie / Studenten / Preis (chips)   — replaces EnrichmentFilters
 *
 * Bug fixes the user asked for:
 *   - "Zurücksetzen" wipes EVERY filter cleanly, restores default 6-mo dateTo,
 *     clears category AND tags so the mutually-exclusive group resets.
 *   - Heute-preset and the custom date inputs share state via applyDatePreset
 *     so they can no longer overwrite each other.
 */
import { useEffect, useMemo, useState } from 'react';
import { T, DATE_PRESETS, PRICE_TIERS, countActiveFilters as countActive, type DatePresetId } from './tokens';
import { applyDatePreset, defaultDateTo, detectActivePreset } from './datePresets';
import { CATEGORIES } from '@/lib/categories';
import { BUNDESLAENDER, type Bundesland } from '@/lib/bundeslaender';
import { getDistrictsByBundesland } from '@/lib/districtsAT';
import type { EventFilters } from '@/types/events';
import { trackEvent } from '@/lib/analytics';

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: EventFilters;
  onFiltersChange: (f: EventFilters) => void;
  bundesland: Bundesland;
  onBundeslandChange: (bl: Bundesland) => void;
  /** Live result count for the "X Events anzeigen" CTA. */
  resultCount: number;
  /** Optional category counts so chips can show "Musik · 18". Skip if unknown. */
  categoryCounts?: Record<string, number>;
}

export function FilterDrawer({
  open,
  onClose,
  filters,
  onFiltersChange,
  bundesland,
  onBundeslandChange,
  resultCount,
  categoryCounts,
}: FilterDrawerProps) {
  // Local draft so the user can fiddle without thrashing the map. Apply on
  // CTA click; Reset wipes the draft.
  const [draft, setDraft] = useState<EventFilters>(filters);
  const [draftBl, setDraftBl] = useState<Bundesland>(bundesland);
  // Track the explicitly-chosen date preset id. We can't reliably reverse-
  // derive it from dateFrom/dateTo because two presets can map to the same
  // range (e.g. "Jetzt" and "Heute" both = today→today; on a Saturday
  // "Wochenende" and "Diese Woche" overlap). Tracking the choice means the
  // chip the user picks stays highlighted instead of jumping to a sibling.
  const [activePresetId, setActivePresetId] = useState<DatePresetId | null>(null);
  const [showCustomDate, setShowCustomDate] = useState(false);

  // Re-seed draft whenever the drawer opens — picks up external changes
  // (e.g. search-pill edits) since the last apply.
  useEffect(() => {
    if (open) {
      setDraft(filters);
      setDraftBl(bundesland);
      const detected = detectActivePreset(filters.dateFrom, filters.dateTo);
      setActivePresetId(detected);
      setShowCustomDate(detected === null && (!!filters.dateFrom || !!filters.dateTo));
    }
  }, [open, filters, bundesland]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const dDefault = defaultDateTo();

  const districts = useMemo(
    () => (draftBl.id !== 'all' ? getDistrictsByBundesland(draftBl.id) : []),
    [draftBl.id],
  );

  const handleApply = () => {
    onBundeslandChange(draftBl);
    onFiltersChange(draft);
    trackEvent('filter_apply', {
      count_active: countActive(draft, dDefault) + (draftBl.id !== 'all' ? 1 : 0),
    });
    onClose();
  };

  const handleReset = () => {
    // Single canonical reset — wipes draft + applies immediately so the user
    // sees the map repopulate before the drawer closes.
    // Reset removes ALL filters including the date upper bound — load
    // every event we have. The progressive batch loader handles the
    // size, and users were missing winter events that fell past the
    // old 6-month default horizon.
    const cleared: EventFilters = {};
    setDraft(cleared);
    setDraftBl(BUNDESLAENDER[0]);
    setActivePresetId(null);
    setShowCustomDate(false);
    onBundeslandChange(BUNDESLAENDER[0]);
    onFiltersChange(cleared);
    trackEvent('filter_reset', {});
  };

  const setPreset = (id: typeof DATE_PRESETS[number]['id']) => {
    if (id === 'custom') {
      setActivePresetId('custom');
      setShowCustomDate(true);
      return;
    }
    const r = applyDatePreset(id);
    if (r) {
      setActivePresetId(id);
      setShowCustomDate(false);
      setDraft((d) => ({ ...d, dateFrom: r.dateFrom, dateTo: r.dateTo ?? dDefault }));
    }
  };

  const setCategory = (cat: string | undefined) => {
    // Category and tags are mutually exclusive — picking a category wipes any
    // tag selection so "category: Musik" + "tags: ['rock']" can't coexist
    // (Bug #3 the user confirmed).
    setDraft((d) => ({ ...d, category: cat, tags: undefined }));
  };

  // Plain conditional render with CSS transitions instead of AnimatePresence.
  // Earlier attempts with framer-motion's AnimatePresence kept the dialog in
  // the DOM after `open` flipped to false (opacity:0 leftover blocked clicks
  // on the filter button below). CSS transitions are good enough for this
  // pattern and don't need exit-animation orchestration.
  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(17,17,20,0.45)',
          zIndex: 80,
          backdropFilter: 'blur(2px)',
          animation: 'mv3-fade-in 0.18s ease-out',
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter"
        className="hidden md:flex"
        style={{
          position: 'fixed',
          top: 88,
          left: 0,
          right: 0,
          marginLeft: 'auto',
          marginRight: 'auto',
          width: 'min(720px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 120px)',
          background: '#fff',
          borderRadius: 16,
          border: `1px solid ${T.border}`,
          boxShadow: T.shadowL,
          overflow: 'hidden',
          flexDirection: 'column',
          zIndex: 90,
          animation: 'mv3-modal-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <DrawerHeader onClose={onClose} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 24px' }}>
          <Body
            draft={draft}
            setDraft={setDraft}
            draftBl={draftBl}
            setDraftBl={setDraftBl}
            districts={districts}
            activePresetId={activePresetId}
            setPreset={setPreset}
            showCustomDate={showCustomDate}
            setShowCustomDate={setShowCustomDate}
            setCategory={setCategory}
            categoryCounts={categoryCounts}
          />
        </div>
        <DrawerFooter onReset={handleReset} onApply={handleApply} count={resultCount} />
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter"
        className="flex md:hidden flex-col"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          top: 80,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
          zIndex: 90,
          animation: 'mv3-sheet-up 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ padding: '10px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, background: T.border, borderRadius: 9999 }} />
        </div>
        <DrawerHeader onClose={onClose} />
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          <Body
            draft={draft}
            setDraft={setDraft}
            draftBl={draftBl}
            setDraftBl={setDraftBl}
            districts={districts}
            activePresetId={activePresetId}
            setPreset={setPreset}
            showCustomDate={showCustomDate}
            setShowCustomDate={setShowCustomDate}
            setCategory={setCategory}
            categoryCounts={categoryCounts}
          />
        </div>
        <DrawerFooter onReset={handleReset} onApply={handleApply} count={resultCount} />
      </div>

      <style jsx global>{`
        @keyframes mv3-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mv3-modal-in { from { opacity: 0; transform: translateY(-8px) scale(0.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes mv3-sheet-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  );
}

/* ─── Body (shared between desktop and mobile) ─────────────────────────── */

interface BodyProps {
  draft: EventFilters;
  setDraft: React.Dispatch<React.SetStateAction<EventFilters>>;
  draftBl: Bundesland;
  setDraftBl: (bl: Bundesland) => void;
  districts: { name: string }[];
  activePresetId: DatePresetId | null;
  setPreset: (id: DatePresetId) => void;
  showCustomDate: boolean;
  setShowCustomDate: (v: boolean) => void;
  setCategory: (cat: string | undefined) => void;
  categoryCounts?: Record<string, number>;
}

function Body({
  draft,
  setDraft,
  draftBl,
  setDraftBl,
  districts,
  activePresetId,
  setPreset,
  showCustomDate,
  setShowCustomDate,
  setCategory,
  categoryCounts,
}: BodyProps) {
  return (
    <>
      <FilterBlock label="Wann">
        <ChipGroup>
          {DATE_PRESETS.map((p) => {
            // Highlight whichever chip the user actually clicked. Earlier we
            // derived this from dateFrom/dateTo via detectActivePreset, but
            // multiple chips can map to the same range (Jetzt≡Heute,
            // Wochenende≡Diese Woche on a Saturday) so the visual jumped.
            const active = activePresetId === p.id || (p.id === 'custom' && showCustomDate);
            return (
              <Chip key={p.id} active={active} onClick={() => setPreset(p.id)}>
                {p.label}
              </Chip>
            );
          })}
        </ChipGroup>
        {showCustomDate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <input
              type="date"
              value={draft.dateFrom || ''}
              onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value || undefined }))}
              style={dateInputStyle}
            />
            <span style={{ color: T.ink50, fontSize: 12 }}>–</span>
            <input
              type="date"
              value={draft.dateTo && draft.dateTo !== defaultDateTo() ? draft.dateTo : ''}
              onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value || defaultDateTo() }))}
              style={dateInputStyle}
            />
          </div>
        )}
      </FilterBlock>

      <FilterBlock label="Region">
        <ChipGroup>
          {BUNDESLAENDER.map((bl) => (
            <Chip
              key={bl.id}
              active={draftBl.id === bl.id}
              onClick={() => {
                setDraftBl(bl);
                // Switching BL invalidates any district selection
                setDraft((d) => (d.district ? { ...d, district: undefined } : d));
              }}
            >
              {bl.name === 'Ganz Österreich' ? 'Österreich' : bl.name}
            </Chip>
          ))}
        </ChipGroup>
        {districts.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <ChipGroup>
              <Chip
                active={!draft.district}
                onClick={() => setDraft((d) => ({ ...d, district: undefined }))}
              >
                Alle Bezirke
              </Chip>
              {districts.map((d) => (
                <Chip
                  key={d.name}
                  active={draft.district === d.name}
                  onClick={() => setDraft((prev) => ({ ...prev, district: d.name }))}
                >
                  {d.name}
                </Chip>
              ))}
            </ChipGroup>
          </div>
        )}
      </FilterBlock>

      <FilterBlock label="Kategorie">
        <ChipGroup>
          <Chip active={!draft.category} onClick={() => setCategory(undefined)}>
            Alle
          </Chip>
          {CATEGORIES.map((cat) => {
            const n = categoryCounts?.[cat];
            const active = draft.category === cat;
            return (
              <Chip key={cat} active={active} onClick={() => setCategory(active ? undefined : cat)}>
                {cat}
                {typeof n === 'number' && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.6, marginLeft: 6 }}>{n}</span>
                )}
              </Chip>
            );
          })}
        </ChipGroup>
      </FilterBlock>

      <FilterBlock label="Mit wem">
        <ChipGroup>
          <Chip
            active={!!draft.familyFriendly}
            onClick={() => setDraft((d) => ({ ...d, familyFriendly: !d.familyFriendly || undefined }))}
          >
            Familie
          </Chip>
          <Chip
            active={!!draft.studentFriendly}
            onClick={() => setDraft((d) => ({ ...d, studentFriendly: !d.studentFriendly || undefined }))}
          >
            Studenten
          </Chip>
        </ChipGroup>
      </FilterBlock>

      <FilterBlock label="Preis">
        <ChipGroup>
          {PRICE_TIERS.map((t) => {
            const active = draft.priceTier === t.id;
            return (
              <Chip
                key={t.id}
                active={active}
                onClick={() => setDraft((d) => ({ ...d, priceTier: active ? undefined : t.id }))}
              >
                {t.label}
              </Chip>
            );
          })}
        </ChipGroup>
      </FilterBlock>
    </>
  );
}

/* ─── Sub-components ───────────────────────────────────────────────────── */

function DrawerHeader({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 22px 14px',
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: T.ink }}>Filter</div>
      <button
        onClick={onClose}
        aria-label="Filter schließen"
        className="press-haptic"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: T.panel,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.ink} strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function DrawerFooter({
  onReset,
  onApply,
  count,
}: {
  onReset: () => void;
  onApply: () => void;
  count: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 22px',
        borderTop: `1px solid ${T.border}`,
        background: T.panel,
        flexShrink: 0,
      }}
    >
      <button
        onClick={onReset}
        className="press-haptic"
        style={{
          padding: '8px 4px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          color: T.ink,
          textDecoration: 'underline',
          fontFamily: 'inherit',
        }}
      >
        Alle zurücksetzen
      </button>
      <button
        onClick={onApply}
        className="press-haptic"
        style={{
          padding: '12px 22px',
          borderRadius: 12,
          background: T.ink,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: 'inherit',
          letterSpacing: '-0.01em',
          minHeight: 44,
        }}
      >
        {count.toLocaleString('de-AT')} Events anzeigen
      </button>
    </div>
  );
}

function FilterBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', color: T.ink, marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipGroup({ children }: { children: React.ReactNode }) {
  // CSS Grid auto-fill — every chip gets the same column width so the
  // group reads as a tidy block instead of left-flushed flex chips of
  // varying length. Class lives in globals.css.
  return <div className="mv3-chip-group">{children}</div>;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="press-haptic"
      style={{
        // display:flex (not inline-flex) so the chip fills its grid cell
        // and the whole row reads as a clean block.
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 9999,
        background: active ? T.ink : '#fff',
        color: active ? '#fff' : T.ink,
        border: active ? '1px solid transparent' : `1px solid ${T.border}`,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        letterSpacing: '-0.005em',
        minHeight: 36,
        whiteSpace: 'nowrap',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </button>
  );
}

const dateInputStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  fontWeight: 500,
  border: `1px solid ${T.border}`,
  borderRadius: 9999,
  background: '#fff',
  color: T.ink,
  fontFamily: 'inherit',
  outline: 'none',
};

