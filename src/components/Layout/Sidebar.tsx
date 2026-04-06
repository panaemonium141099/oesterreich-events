'use client';

import { EventList } from '../Events/EventList';
import { ArtistEventsSection } from '../Artists/ArtistEventsSection';
import { SkeletonList } from '../UI/Skeleton';
import type { Event } from '@/types/events';
import type { ArtistEvent } from '../Artists/ArtistEventCard';

export type SidebarTab = 'events' | 'artists';

interface SidebarProps {
  events: Event[];
  loading: boolean;
  onSelectEvent: (event: Event) => void;
  selectedEventId: string | null;
  onHoverEvent: (id: string | null) => void;
  eveningMode?: boolean;
  // Artist events tab
  activeTab?: SidebarTab;
  onTabChange?: (tab: SidebarTab) => void;
  showArtistTab?: boolean;
  artistEventCount?: number;
  onSelectArtistEvent?: (event: ArtistEvent) => void;
}

export function Sidebar({
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
}: SidebarProps) {
  const isArtistTab = activeTab === 'artists' && showArtistTab;

  return (
    <aside className={`h-full flex flex-col overflow-hidden transition-all duration-500 ${
      isArtistTab ? 'w-[500px]' : 'w-[380px]'
    } ${
      eveningMode
        ? 'bg-slate-900/65 backdrop-blur-xl border-r border-slate-700/30'
        : 'bg-white/65 backdrop-blur-xl border-r border-slate-200/50'
    }`}>
      {/* Header with tabs */}
      <div className={`px-4 pt-3 pb-2 border-b ${eveningMode ? 'border-gray-800/50' : 'border-slate-100'}`}>
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
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
              eveningMode ? 'bg-amber-400/15 text-amber-400/80' : 'bg-slate-200/80 text-slate-600'
            }`}>
              {activeTab === 'events'
                ? `${events.length.toLocaleString('de-AT')} Ergebnisse`
                : `${artistEventCount} Events`
              }
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold tracking-wider uppercase ${
                eveningMode ? 'text-gray-400' : 'text-slate-500'
              }`}>Veranstaltungen</span>
            </div>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
              eveningMode ? 'bg-amber-400/15 text-amber-400/80' : 'bg-slate-200/80 text-slate-600'
            }`}>
              {events.length.toLocaleString('de-AT')} Ergebnisse
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isArtistTab ? (
          <ArtistEventsSection
            onSelectEvent={(event) => {
              // Convert ArtistEvent to Event-compatible object for map fly-to
              if (onSelectArtistEvent) {
                onSelectArtistEvent(event);
              }
            }}
            selectedEventId={selectedEventId}
            onHoverEvent={onHoverEvent}
            eveningMode={eveningMode}
          />
        ) : loading ? (
          <SkeletonList count={6} eveningMode={eveningMode} />
        ) : events.length === 0 ? (
          <EmptyState eveningMode={eveningMode} />
        ) : (
          <EventList
            events={events}
            onSelectEvent={onSelectEvent}
            selectedEventId={selectedEventId}
            onHoverEvent={onHoverEvent}
            eveningMode={eveningMode}
          />
        )}
      </div>
    </aside>
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
