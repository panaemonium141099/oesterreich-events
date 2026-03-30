'use client';

import { EventList } from '../Events/EventList';
import { SkeletonList } from '../UI/Skeleton';
import type { Event } from '@/types/events';

interface SidebarProps {
  events: Event[];
  loading: boolean;
  onSelectEvent: (event: Event) => void;
  selectedEventId: string | null;
  onHoverEvent: (id: string | null) => void;
  eveningMode?: boolean;
}

export function Sidebar({ events, loading, onSelectEvent, selectedEventId, onHoverEvent, eveningMode }: SidebarProps) {
  return (
    <aside className={`w-[380px] h-full flex flex-col overflow-hidden transition-all duration-500 ${
      eveningMode
        ? 'bg-slate-900/65 backdrop-blur-xl border-r border-slate-700/30'
        : 'bg-white/65 backdrop-blur-xl border-r border-slate-200/50'
    }`}>
      {/* Header */}
      <div className={`px-4 pt-3 pb-2 border-b ${eveningMode ? 'border-gray-800/50' : 'border-slate-100'}`}>
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
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
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
