'use client';

import { useEffect, useRef } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  animate,
  useReducedMotion,
  type PanInfo,
} from 'framer-motion';
import { EventList } from '../Events/EventList';
import { ArtistEventsSection } from '../Artists/ArtistEventsSection';
import { SkeletonList } from '../UI/Skeleton';
import { SortBar, type SortMode } from './SortBar';
import { FilterPanel } from './FilterPanel';
import type { Event, EventFilters } from '@/types/events';
import type { ArtistEvent } from '../Artists/ArtistEventCard';
import type { Bundesland } from '@/lib/bundeslaender';

export type SidebarTab = 'events' | 'artists';
export type SidebarSize = 'compact' | 'wide' | 'full';

const COMPACT_WIDTH = 380;
const WIDE_WIDTH = 640;
const MIN_WIDTH = 320;
const FILTER_PANEL_WIDE = 260;
const FILTER_PANEL_FULL = 360;

interface SidebarProps {
  events: Event[];
  loading: boolean;
  onSelectEvent: (event: Event) => void;
  selectedEventId: string | null;
  onHoverEvent: (id: string | null) => void;
  eveningMode?: boolean;
  // Artist tab
  activeTab?: SidebarTab;
  onTabChange?: (tab: SidebarTab) => void;
  showArtistTab?: boolean;
  artistEventCount?: number;
  onSelectArtistEvent?: (event: ArtistEvent) => void;
  // Sort
  sortMode: SortMode;
  onSortChange: (m: SortMode) => void;
  hasLocation: boolean;
  // Resize + filters (desktop only)
  variant?: 'desktop' | 'mobile';
  size?: SidebarSize;
  onSizeChange?: (s: SidebarSize) => void;
  filters?: EventFilters;
  onFiltersChange?: (f: EventFilters) => void;
  bundesland?: Bundesland;
  onBundeslandChange?: (bl: Bundesland) => void;
  allEventsForFilters?: Event[]; // unfiltered set used for tag aggregation in FilterPanel
}

export function Sidebar(props: SidebarProps) {
  if (props.variant === 'mobile') {
    return <MobileSidebar {...props} />;
  }
  return <DesktopSidebar {...props} />;
}

/* ─── Mobile Sidebar ───────────────────────────────────────────── */

function MobileSidebar({
  events,
  loading,
  onSelectEvent,
  selectedEventId,
  onHoverEvent,
  eveningMode,
  activeTab = 'events',
  onTabChange,
  showArtistTab = false,
  artistEventCount = 0,
  onSelectArtistEvent,
  sortMode,
  onSortChange,
  hasLocation,
}: SidebarProps) {
  const isArtistTab = activeTab === 'artists' && showArtistTab;
  return (
    <aside className={`h-full w-full flex flex-col overflow-hidden ${
      eveningMode ? 'bg-slate-900/95' : 'bg-white/95'
    }`}>
      <SidebarHeader
        events={events}
        eveningMode={eveningMode}
        activeTab={activeTab}
        onTabChange={onTabChange}
        showArtistTab={showArtistTab}
        artistEventCount={artistEventCount}
        sortMode={sortMode}
        onSortChange={onSortChange}
        hasLocation={hasLocation}
      />
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <SidebarBody
          events={events}
          loading={loading}
          onSelectEvent={onSelectEvent}
          selectedEventId={selectedEventId}
          onHoverEvent={onHoverEvent}
          eveningMode={eveningMode}
          isArtistTab={isArtistTab}
          onSelectArtistEvent={onSelectArtistEvent}
        />
      </div>
    </aside>
  );
}

/* ─── Desktop Sidebar (resizable) ──────────────────────────────── */

function DesktopSidebar({
  events,
  loading,
  onSelectEvent,
  selectedEventId,
  onHoverEvent,
  eveningMode,
  activeTab = 'events',
  onTabChange,
  showArtistTab = false,
  artistEventCount = 0,
  onSelectArtistEvent,
  sortMode,
  onSortChange,
  hasLocation,
  size = 'compact',
  onSizeChange,
  filters,
  onFiltersChange,
  bundesland,
  onBundeslandChange,
  allEventsForFilters,
}: SidebarProps) {
  const reduceMotion = useReducedMotion();
  const isArtistTab = activeTab === 'artists' && showArtistTab;
  const widthMV = useMotionValue(COMPACT_WIDTH);
  const dragging = useRef(false);

  const getTargetWidth = (s: SidebarSize): number => {
    if (typeof window === 'undefined') return s === 'compact' ? COMPACT_WIDTH : WIDE_WIDTH;
    if (s === 'compact') return COMPACT_WIDTH;
    if (s === 'wide') return WIDE_WIDTH;
    return window.innerWidth; // full-screen overlay, no peek
  };

  // Sync external size changes → animate the width
  useEffect(() => {
    if (dragging.current) return;
    const target = getTargetWidth(size);
    const controls = animate(widthMV, target, {
      duration: reduceMotion ? 0 : 0.42,
      ease: [0.32, 0.72, 0, 1],
    });
    return () => controls.stop();
  }, [size, widthMV, reduceMotion]);

  // Keep full-mode width correct on window resize
  useEffect(() => {
    if (size !== 'full') return;
    const onResize = () => widthMV.set(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [size, widthMV]);

  const handleDrag = (_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    dragging.current = true;
    const maxW = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const next = Math.min(maxW, Math.max(MIN_WIDTH, widthMV.get() + info.delta.x));
    widthMV.set(next);
  };

  const handleDragEnd = () => {
    dragging.current = false;
    const w = widthMV.get();
    const maxW = typeof window !== 'undefined' ? window.innerWidth : 1400;
    const midCompactWide = (COMPACT_WIDTH + WIDE_WIDTH) / 2;
    const midWideFull = (WIDE_WIDTH + maxW) / 2;

    const nextSize: SidebarSize =
      w < midCompactWide ? 'compact' : w < midWideFull ? 'wide' : 'full';

    onSizeChange?.(nextSize);
    // Re-snap exactly to the target (onSizeChange effect handles animation when state updates)
    // But if the size is unchanged the effect won't fire — snap manually
    const target = getTargetWidth(nextSize);
    if (Math.abs(w - target) > 0.5) {
      animate(widthMV, target, {
        duration: reduceMotion ? 0 : 0.35,
        ease: [0.32, 0.72, 0, 1],
      });
    }
  };

  const cycleSize = () => {
    const order: SidebarSize[] = ['compact', 'wide', 'full'];
    const idx = order.indexOf(size);
    const next = order[(idx + 1) % order.length];
    onSizeChange?.(next);
  };

  const collapse = () => {
    if (size === 'compact') return;
    onSizeChange?.(size === 'full' ? 'wide' : 'compact');
  };

  const showFilterPanel =
    size !== 'compact' && !isArtistTab && filters && onFiltersChange && bundesland && onBundeslandChange;
  const filterPanelWidth = size === 'full' ? FILTER_PANEL_FULL : FILTER_PANEL_WIDE;
  const cardVariant: 'compact' | 'expanded' = size === 'full' ? 'expanded' : 'compact';

  return (
    <motion.aside
      style={{ width: widthMV }}
      className={`h-full flex overflow-hidden relative shadow-[8px_0_32px_-12px_rgba(15,23,42,0.18)] ${
        eveningMode
          ? 'bg-slate-900/80 backdrop-blur-xl border-r border-slate-700/40'
          : 'bg-white/85 backdrop-blur-xl border-r border-slate-200/60'
      }`}
    >
      {/* Left: FilterPanel (only in wide/full) */}
      <AnimatePresence initial={false}>
        {showFilterPanel && (
          <motion.div
            key="filter-panel"
            initial={reduceMotion ? undefined : { width: 0, opacity: 0 }}
            animate={{ width: filterPanelWidth, opacity: 1 }}
            exit={reduceMotion ? undefined : { width: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="shrink-0 overflow-hidden"
          >
            <div style={{ width: filterPanelWidth }} className="h-full">
              <FilterPanel
                filters={filters!}
                onFiltersChange={onFiltersChange!}
                bundesland={bundesland!}
                onBundeslandChange={onBundeslandChange!}
                events={allEventsForFilters ?? events}
                eveningMode={eveningMode}
                expanded={size === 'full'}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right: list column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <SidebarHeader
          events={events}
          eveningMode={eveningMode}
          activeTab={activeTab}
          onTabChange={onTabChange}
          showArtistTab={showArtistTab}
          artistEventCount={artistEventCount}
          sortMode={sortMode}
          onSortChange={onSortChange}
          hasLocation={hasLocation}
          size={size}
          onCycleSize={cycleSize}
          onCollapse={collapse}
        />
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <SidebarBody
            events={events}
            loading={loading}
            onSelectEvent={onSelectEvent}
            selectedEventId={selectedEventId}
            onHoverEvent={onHoverEvent}
            eveningMode={eveningMode}
            isArtistTab={isArtistTab}
            onSelectArtistEvent={onSelectArtistEvent}
            cardVariant={cardVariant}
          />
        </div>
      </div>

      {/* Drag handle on right edge */}
      <motion.div
        role="separator"
        aria-orientation="vertical"
        aria-label="Seitenleiste vergrößern"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); cycleSize(); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); collapse(); }
        }}
        onPan={handleDrag}
        onPanEnd={handleDragEnd}
        className={`absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize group touch-none select-none focus-visible:outline-none`}
      >
        <div className={`absolute inset-y-0 right-0 w-px transition-colors ${
          eveningMode
            ? 'bg-gray-700/50 group-hover:bg-amber-400/70 group-focus-visible:bg-amber-400/70'
            : 'bg-slate-200/70 group-hover:bg-blue-500/70 group-focus-visible:bg-blue-500/70'
        }`} />
        <div className={`absolute top-1/2 right-0 -translate-y-1/2 h-10 w-1 rounded-l opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity ${
          eveningMode ? 'bg-amber-400/80' : 'bg-blue-500/80'
        }`} />
      </motion.div>
    </motion.aside>
  );
}

/* ─── Header (tabs + sort + size controls) ─────────────────────── */

function SidebarHeader({
  events,
  eveningMode,
  activeTab = 'events',
  onTabChange,
  showArtistTab = false,
  artistEventCount = 0,
  sortMode,
  onSortChange,
  hasLocation,
  size,
  onCycleSize,
  onCollapse,
}: {
  events: Event[];
  eveningMode?: boolean;
  activeTab?: SidebarTab;
  onTabChange?: (t: SidebarTab) => void;
  showArtistTab?: boolean;
  artistEventCount?: number;
  sortMode: SortMode;
  onSortChange: (m: SortMode) => void;
  hasLocation: boolean;
  size?: SidebarSize;
  onCycleSize?: () => void;
  onCollapse?: () => void;
}) {
  const isArtistTab = activeTab === 'artists' && showArtistTab;
  return (
    <div className={`border-b shrink-0 ${eveningMode ? 'border-gray-800/60' : 'border-slate-100'}`}>
      <div className="px-4 pt-3 pb-2">
        {showArtistTab ? (
          <div className="flex items-center gap-1">
            <TabButton
              active={activeTab === 'events'}
              onClick={() => onTabChange?.('events')}
              eveningMode={eveningMode}
            >
              Alle Events
            </TabButton>
            <TabButton
              active={activeTab === 'artists'}
              onClick={() => onTabChange?.('artists')}
              eveningMode={eveningMode}
              badge={artistEventCount > 0 ? artistEventCount : undefined}
            >
              Kuenstler-Events
            </TabButton>
            <div className="flex-1" />
            <HeaderBadge eveningMode={eveningMode}>
              {activeTab === 'events'
                ? `${events.length.toLocaleString('de-AT')} Ergebnisse`
                : `${artistEventCount} Events`}
            </HeaderBadge>
            {onCycleSize && <SizeControls size={size} onCycle={onCycleSize} onCollapse={onCollapse} eveningMode={eveningMode} />}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-xs font-semibold tracking-wider uppercase ${
                eveningMode ? 'text-gray-400' : 'text-slate-500'
              }`}>Veranstaltungen</span>
            </div>
            <div className="flex items-center gap-2">
              <HeaderBadge eveningMode={eveningMode}>
                {events.length.toLocaleString('de-AT')} Ergebnisse
              </HeaderBadge>
              {onCycleSize && <SizeControls size={size} onCycle={onCycleSize} onCollapse={onCollapse} eveningMode={eveningMode} />}
            </div>
          </div>
        )}
      </div>
      {!isArtistTab && (
        <div className="px-4 pb-2.5">
          <SortBar
            value={sortMode}
            onChange={onSortChange}
            hasLocation={hasLocation}
            eveningMode={eveningMode}
          />
        </div>
      )}
    </div>
  );
}

function HeaderBadge({ children, eveningMode }: { children: React.ReactNode; eveningMode?: boolean }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap ${
      eveningMode ? 'bg-amber-400/15 text-amber-400/80' : 'bg-slate-200/80 text-slate-600'
    }`}>
      {children}
    </span>
  );
}

function SizeControls({
  size,
  onCycle,
  onCollapse,
  eveningMode,
}: {
  size?: SidebarSize;
  onCycle: () => void;
  onCollapse?: () => void;
  eveningMode?: boolean;
}) {
  const canCollapse = size !== 'compact';
  return (
    <div className={`flex items-center gap-0.5 rounded-md p-0.5 ${
      eveningMode ? 'bg-gray-800/50' : 'bg-slate-100'
    }`}>
      <button
        onClick={onCollapse}
        disabled={!canCollapse}
        title="Verkleinern"
        aria-label="Seitenleiste verkleinern"
        className={`p-1 rounded transition-colors ${
          canCollapse
            ? eveningMode
              ? 'text-gray-400 hover:text-white hover:bg-gray-700 cursor-pointer'
              : 'text-slate-500 hover:text-slate-900 hover:bg-white cursor-pointer'
            : 'opacity-30 cursor-not-allowed'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={onCycle}
        title={size === 'full' ? 'Zurück zu kompakt' : 'Erweitern'}
        aria-label={size === 'full' ? 'Seitenleiste zurücksetzen' : 'Seitenleiste erweitern'}
        className={`p-1 rounded transition-colors ${
          eveningMode
            ? 'text-gray-400 hover:text-white hover:bg-gray-700 cursor-pointer'
            : 'text-slate-500 hover:text-slate-900 hover:bg-white cursor-pointer'
        }`}
      >
        {size === 'full' ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 20l-5-5 5-5m5 10l5-5-5-5" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        )}
      </button>
    </div>
  );
}

/* ─── Body (list / artist / loading / empty) ───────────────────── */

function SidebarBody({
  events,
  loading,
  onSelectEvent,
  selectedEventId,
  onHoverEvent,
  eveningMode,
  isArtistTab,
  onSelectArtistEvent,
  cardVariant = 'compact',
}: {
  events: Event[];
  loading: boolean;
  onSelectEvent: (e: Event) => void;
  selectedEventId: string | null;
  onHoverEvent: (id: string | null) => void;
  eveningMode?: boolean;
  isArtistTab: boolean;
  onSelectArtistEvent?: (e: ArtistEvent) => void;
  cardVariant?: 'compact' | 'expanded';
}) {
  if (isArtistTab) {
    return (
      <ArtistEventsSection
        onSelectEvent={(event) => onSelectArtistEvent?.(event)}
        selectedEventId={selectedEventId}
        onHoverEvent={onHoverEvent}
        eveningMode={eveningMode}
      />
    );
  }
  if (loading) return <SkeletonList count={6} eveningMode={eveningMode} />;
  if (events.length === 0) return <EmptyState eveningMode={eveningMode} />;
  return (
    <EventList
      events={events}
      onSelectEvent={onSelectEvent}
      selectedEventId={selectedEventId}
      onHoverEvent={onHoverEvent}
      eveningMode={eveningMode}
      variant={cardVariant}
    />
  );
}

function TabButton({
  active,
  onClick,
  eveningMode,
  badge,
  children,
}: {
  active: boolean;
  onClick: () => void;
  eveningMode?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 ${
        active
          ? eveningMode
            ? 'bg-white/10 text-white'
            : 'bg-slate-800 text-white'
          : eveningMode
            ? 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className={`ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full px-1 ${
          active
            ? 'bg-purple-500 text-white'
            : eveningMode
              ? 'bg-purple-900/60 text-purple-300'
              : 'bg-purple-100 text-purple-700'
        }`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

function EmptyState({ eveningMode }: { eveningMode?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <svg className={`w-12 h-12 mb-3 ${eveningMode ? 'text-gray-600' : 'text-slate-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <p className={`text-sm font-medium ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
        Keine Events gefunden
      </p>
      <p className={`text-xs mt-1 ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>
        Versuche andere Filter
      </p>
    </div>
  );
}
