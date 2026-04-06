'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FeedEventMiniCard } from './FeedEventMiniCard';

interface CreatePostProps {
  userId: string;
  userAvatar: string | null;
  userInitial: string;
  onPostCreated: () => void;
}

interface EventSearchResult {
  id: string;
  title: string;
  start_date: string;
  location_name: string | null;
  image_url: string | null;
  category: string | null;
}

export function CreatePost({ userId, userAvatar, userInitial, onPostCreated }: CreatePostProps) {
  const [content, setContent] = useState('');
  const [linkedEvent, setLinkedEvent] = useState<EventSearchResult | null>(null);
  const [showEventSearch, setShowEventSearch] = useState(false);
  const [eventQuery, setEventQuery] = useState('');
  const [eventResults, setEventResults] = useState<EventSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }
  }, [content]);

  // Close search on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowEventSearch(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search events
  useEffect(() => {
    if (!eventQuery.trim() || eventQuery.length < 2) {
      setEventResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from('events')
        .select('id, title, start_date, location_name, image_url, category')
        .ilike('title', `%${eventQuery}%`)
        .gte('start_date', new Date().toISOString())
        .order('start_date', { ascending: true })
        .limit(5);
      setEventResults(data || []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [eventQuery, supabase]);

  const handlePost = async () => {
    if (!content.trim() && !linkedEvent) return;
    setPosting(true);

    try {
      await supabase.from('activities').insert({
        user_id: userId,
        type: 'post',
        content: content.trim() || null,
        event_id: linkedEvent?.id || null,
        metadata: linkedEvent ? { linked_event_title: linkedEvent.title } : null,
      });

      setContent('');
      setLinkedEvent(null);
      onPostCreated();
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Error creating post:', err);
    } finally {
      setPosting(false);
    }
  };

  const canPost = content.trim().length > 0 || linkedEvent !== null;

  return (
    <div className="px-4 py-3 transition-all duration-200">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="shrink-0">
          {userAvatar ? (
            <img src={userAvatar} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-sm font-semibold text-slate-500">
              {userInitial}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Was geht ab?"
            className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 resize-none outline-none min-h-[40px]"
            rows={1}
            maxLength={500}
          />

          {/* Linked event preview */}
          {linkedEvent && (
            <div className="mt-2 relative">
              <FeedEventMiniCard event={linkedEvent} compact />
              <button
                onClick={() => setLinkedEvent(null)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                aria-label="Event entfernen"
              >
                <svg className="w-3 h-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Actions bar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1 relative" ref={searchRef}>
              <button
                onClick={() => setShowEventSearch(!showEventSearch)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                  showEventSearch || linkedEvent
                    ? 'bg-slate-100 text-slate-600'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
                aria-label="Event verlinken"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Event verlinken</span>
              </button>

              {/* Event search dropdown */}
              {showEventSearch && (
                <div className="absolute top-full left-0 mt-1 w-72 rounded-xl bg-white backdrop-blur-xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-fade-in">
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                      <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        value={eventQuery}
                        onChange={(e) => setEventQuery(e.target.value)}
                        placeholder="Event suchen..."
                        className="flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {searchLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                      </div>
                    ) : eventResults.length > 0 ? (
                      <div className="p-1">
                        {eventResults.map((ev) => (
                          <button
                            key={ev.id}
                            onClick={() => {
                              setLinkedEvent(ev);
                              setShowEventSearch(false);
                              setEventQuery('');
                            }}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-slate-50">
                              {ev.image_url ? (
                                <img src={ev.image_url} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">{ev.title}</p>
                              <p className="text-[10px] text-slate-400 truncate">{ev.location_name || 'Ort unbekannt'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : eventQuery.length >= 2 ? (
                      <p className="text-center text-xs text-slate-400 py-4">Keine Events gefunden</p>
                    ) : (
                      <p className="text-center text-xs text-slate-400 py-4">Tippe um zu suchen...</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {content.length > 0 && (
                <span className="text-[10px] text-slate-300">{content.length}/500</span>
              )}
              <button
                onClick={handlePost}
                disabled={!canPost || posting}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 min-h-[36px] ${
                  canPost && !posting
                    ? 'bg-slate-800 text-white hover:bg-slate-700 active:scale-95'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                {posting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                )}
                <span>Posten</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
