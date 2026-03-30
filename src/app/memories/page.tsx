'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SocialNav } from '@/components/Layout/SocialNav';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

interface Memory {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  event_id: string | null;
  created_at: string;
  event?: { id: string; title: string; start_date: string } | null;
  photo_count: number;
  participants: { id: string; user_id: string; profile: { id: string; first_name: string; last_name: string; avatar_url: string | null } }[];
}

interface FriendProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface EventResult {
  id: string;
  title: string;
  start_date: string;
}

export default function MemoriesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventResults, setEventResults] = useState<EventResult[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventResult | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchMemories = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);

    // Get memories where user is creator
    const { data: created } = await supabase
      .from('memories')
      .select('id')
      .eq('created_by', user.id);

    // Get memories where user is participant
    const { data: participated } = await supabase
      .from('memory_participants')
      .select('memory_id')
      .eq('user_id', user.id);

    const memoryIds = new Set<string>();
    created?.forEach(m => memoryIds.add(m.id));
    participated?.forEach(m => memoryIds.add(m.memory_id));

    if (memoryIds.size === 0) {
      setMemories([]);
      setLoadingData(false);
      return;
    }

    const { data: memoriesData } = await supabase
      .from('memories')
      .select('id, title, description, created_by, event_id, created_at')
      .in('id', Array.from(memoryIds))
      .order('created_at', { ascending: false });

    if (!memoriesData) {
      setMemories([]);
      setLoadingData(false);
      return;
    }

    // Enrich with event, photos count, participants
    const enriched = await Promise.all(
      memoriesData.map(async (m) => {
        let event = null;
        if (m.event_id) {
          const { data: e } = await supabase
            .from('events')
            .select('id, title, start_date')
            .eq('id', m.event_id)
            .single();
          event = e;
        }

        const { count: photoCount } = await supabase
          .from('memory_photos')
          .select('*', { count: 'exact', head: true })
          .eq('memory_id', m.id);

        const { data: parts } = await supabase
          .from('memory_participants')
          .select('id, user_id, profile:profiles!memory_participants_user_id_fkey(id, first_name, last_name, avatar_url)')
          .eq('memory_id', m.id);

        return {
          ...m,
          event,
          photo_count: photoCount || 0,
          participants: (parts as any) || [],
        };
      })
    );

    setMemories(enriched);
    setLoadingData(false);
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchMemories();
  }, [user, fetchMemories]);

  // Load friends for create modal
  const loadFriends = useCallback(async () => {
    if (!user) return;
    const { data: accepted } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, first_name, last_name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, first_name, last_name, avatar_url)')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (!accepted) return;
    const friendsList: FriendProfile[] = accepted.map((f: any) => {
      const req = Array.isArray(f.requester) ? f.requester[0] : f.requester;
      const addr = Array.isArray(f.addressee) ? f.addressee[0] : f.addressee;
      return req?.id === user.id ? addr : req;
    });
    setFriends(friendsList);
  }, [user, supabase]);

  useEffect(() => {
    if (showCreate) loadFriends();
  }, [showCreate, loadFriends]);

  // Search events
  useEffect(() => {
    if (!eventSearch.trim()) {
      setEventResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, start_date')
        .ilike('title', `%${eventSearch}%`)
        .order('start_date', { ascending: false })
        .limit(8);
      setEventResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [eventSearch, supabase]);

  const handleCreate = async () => {
    if (!user || !newTitle.trim()) return;
    setCreating(true);

    const { data: memory, error } = await supabase
      .from('memories')
      .insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        event_id: selectedEvent?.id || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !memory) {
      setCreating(false);
      return;
    }

    // Add creator as participant
    await supabase.from('memory_participants').insert({
      memory_id: memory.id,
      user_id: user.id,
    });

    // Add selected friends as participants
    if (selectedFriends.length > 0) {
      await supabase.from('memory_participants').insert(
        selectedFriends.map(fid => ({ memory_id: memory.id, user_id: fid }))
      );
    }

    // Upload photos
    for (const photo of photos) {
      const ext = photo.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${memory.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('memories')
        .upload(path, photo);

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('memories').getPublicUrl(path);
        await supabase.from('memory_photos').insert({
          memory_id: memory.id,
          uploaded_by: user.id,
          image_url: urlData.publicUrl,
        });
      }
    }

    setShowCreate(false);
    setNewTitle('');
    setNewDesc('');
    setSelectedEvent(null);
    setEventSearch('');
    setSelectedFriends([]);
    setPhotos([]);
    setCreating(false);
    await fetchMemories();
    router.push(`/memories/${memory.id}`);
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const Avatar = ({ url, name, size = 'sm' }: { url: string | null; name: string; size?: 'sm' | 'md' }) => {
    const s = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
    return url ? (
      <img src={url} alt="" className={`${s} rounded-full object-cover`} />
    ) : (
      <div className={`${s} rounded-full bg-white/10 flex items-center justify-center font-semibold text-white/60`}>
        {name?.[0]?.toUpperCase() || '?'}
      </div>
    );
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white pb-24 gradient-mesh"
    >
      <SocialNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Memories</h1>
            <p className="text-white/40 text-sm mt-1">{memories.length} {memories.length === 1 ? 'Erinnerung' : 'Erinnerungen'}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Memory
          </button>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#111] border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">Neues Memory erstellen</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Titel *</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="z.B. Nova Rock 2026"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Beschreibung</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Was war besonders an diesem Erlebnis?"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                  />
                </div>

                {/* Event Link */}
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Event verkn&uuml;pfen</label>
                  {selectedEvent ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedEvent.title}</p>
                        <p className="text-xs text-white/30">{formatDate(selectedEvent.start_date)}</p>
                      </div>
                      <button onClick={() => { setSelectedEvent(null); setEventSearch(''); }} className="text-xs text-white/40 hover:text-white">
                        &times;
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        placeholder="Event suchen..."
                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                      />
                      {eventResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                          {eventResults.map(e => (
                            <button
                              key={e.id}
                              onClick={() => { setSelectedEvent(e); setEventSearch(''); setEventResults([]); }}
                              className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors"
                            >
                              <p className="text-sm truncate">{e.title}</p>
                              <p className="text-xs text-white/30">{formatDate(e.start_date)}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Participants */}
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Teilnehmer (Freunde)</label>
                  {friends.length === 0 ? (
                    <p className="text-xs text-white/20 py-2">Noch keine Freunde hinzugef&uuml;gt</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {friends.map(f => (
                        <button
                          key={f.id}
                          onClick={() => toggleFriend(f.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-colors ${
                            selectedFriends.includes(f.id)
                              ? 'bg-white text-black'
                              : 'bg-white/5 border border-white/10 text-white/60 hover:border-white/20'
                          }`}
                        >
                          <Avatar url={f.avatar_url} name={f.first_name} />
                          {f.first_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Photos */}
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Fotos</label>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden">
                        <img src={URL.createObjectURL(p)} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/60 rounded-full flex items-center justify-center text-[10px] text-white"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    <label className="w-16 h-16 rounded-lg border border-dashed border-white/20 flex items-center justify-center cursor-pointer hover:border-white/40 transition-colors">
                      <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors text-sm"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim()}
                  className="flex-1 py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center"
                >
                  {creating ? (
                    <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : (
                    'Erstellen'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Memories List */}
        {loadingData ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm mb-1">Noch keine Memories</p>
            <p className="text-white/20 text-xs">Erstelle dein erstes Memory von einem Event</p>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map((m) => (
              <Link
                key={m.id}
                href={`/memories/${m.id}`}
                className="block p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{m.title}</h3>
                    <p className="text-xs text-white/30 mt-0.5">{formatDate(m.created_at)}</p>
                    {m.event && (
                      <p className="text-xs text-white/40 mt-1 truncate">
                        <span className="text-white/20">Event:</span> {m.event.title}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {m.photo_count > 0 && (
                        <span className="text-xs text-white/20">{m.photo_count} Fotos</span>
                      )}
                      {m.participants.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {m.participants.slice(0, 4).map((p: any) => {
                            const prof = Array.isArray(p.profile) ? p.profile[0] : p.profile;
                            return (
                              <Avatar
                                key={p.id}
                                url={prof?.avatar_url}
                                name={prof?.first_name || '?'}
                              />
                            );
                          })}
                          {m.participants.length > 4 && (
                            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white/40">
                              +{m.participants.length - 4}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
