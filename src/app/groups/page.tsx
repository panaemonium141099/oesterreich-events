'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SocialNav } from '@/components/Layout/SocialNav';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { LocationAutocomplete } from '@/components/UI/LocationAutocomplete';
import { ProfileDropdown } from '@/components/Layout/ProfileDropdown';

interface PlannedEvent {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_by: string;
  invite_code: string;
  created_at: string;
  event_type: string;
  linked_event_id: string | null;
  location_name: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  event_date: string | null;
  notes: string | null;
  member_count: number;
  rsvp_counts: { accepted: number; maybe: number; pending: number; declined: number };
  last_message: string | null;
  last_message_at: string | null;
  linked_event?: { title: string; image_url: string | null } | null;
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
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
}

type CreateMode = null | 'custom' | 'existing';

export default function EventPlanenPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [events, setEvents] = useState<PlannedEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLat, setNewLat] = useState<number | null>(null);
  const [newLng, setNewLng] = useState<number | null>(null);
  const [newNotes, setNewNotes] = useState('');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Existing event search
  const [eventSearch, setEventSearch] = useState('');
  const [eventResults, setEventResults] = useState<EventResult[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventResult | null>(null);

  // Friends for invite
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [friendSearch, setFriendSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchEvents = useCallback(async () => {
    if (!user) return;
    setLoadingEvents(true);

    try {
      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id, rsvp')
        .eq('user_id', user.id);

      if (!memberships || memberships.length === 0) {
        setEvents([]);
        setLoadingEvents(false);
        return;
      }

      const groupIds = memberships.map((m: { group_id: string }) => m.group_id);

      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .in('id', groupIds)
        .order('event_date', { ascending: true, nullsFirst: false });

      if (!groupsData) {
        setEvents([]);
        setLoadingEvents(false);
        return;
      }

      const enriched = await Promise.all(
        groupsData.map(async (g: any) => {
          const { data: members } = await supabase
            .from('group_members')
            .select('rsvp')
            .eq('group_id', g.id);

          const rsvp_counts = { accepted: 0, maybe: 0, pending: 0, declined: 0 };
          (members || []).forEach((m: { rsvp: string }) => {
            if (m.rsvp === 'accepted') rsvp_counts.accepted++;
            else if (m.rsvp === 'maybe') rsvp_counts.maybe++;
            else if (m.rsvp === 'declined') rsvp_counts.declined++;
            else rsvp_counts.pending++;
          });

          const { data: lastMsg } = await supabase
            .from('group_messages')
            .select('content, created_at')
            .eq('group_id', g.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let linked_event = null;
          if (g.linked_event_id) {
            const { data: evt } = await supabase
              .from('events')
              .select('title, image_url')
              .eq('id', g.linked_event_id)
              .single();
            linked_event = evt;
          }

          return {
            ...g,
            member_count: (members || []).length,
            rsvp_counts,
            last_message: lastMsg?.content || null,
            last_message_at: lastMsg?.created_at || null,
            linked_event,
          };
        })
      );

      setEvents(enriched);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchEvents();
  }, [user, fetchEvents]);

  // Load friends
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
    if (showCreate && createMode) loadFriends();
  }, [showCreate, createMode, loadFriends]);

  // Search events for "existing event" mode
  useEffect(() => {
    if (!eventSearch.trim()) {
      setEventResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('events')
        .select('id, title, start_date, location_name, address, latitude, longitude, image_url')
        .ilike('title', `%${eventSearch}%`)
        .order('start_date', { ascending: true })
        .limit(8);
      setEventResults(data || []);
    }, 300);
    return () => clearTimeout(timer);
  }, [eventSearch, supabase]);

  const handleCreate = async () => {
    if (!user) return;
    if (createMode === 'custom' && !newName.trim()) return;
    if (createMode === 'existing' && !selectedEvent) return;
    setCreating(true);
    setCreateError(null);

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    let eventDate: string | null = null;
    if (createMode === 'existing' && selectedEvent) {
      eventDate = selectedEvent.start_date;
    } else if (newDate) {
      eventDate = newTime
        ? new Date(`${newDate}T${newTime}`).toISOString()
        : new Date(`${newDate}T00:00:00`).toISOString();
    }

    // Upload image if provided
    let imageUrl: string | null = null;
    if (newImage) {
      const ext = newImage.name.split('.').pop() || 'jpg';
      const path = `groups/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('group-images')
        .upload(path, newImage, { contentType: newImage.type });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('group-images').getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
    }

    const insertData: any = {
      name: createMode === 'existing' ? selectedEvent!.title : newName.trim(),
      description: newDesc.trim() || null,
      image_url: imageUrl,
      created_by: user.id,
      invite_code: inviteCode,
      event_type: createMode === 'existing' ? 'existing_event' : 'custom',
      linked_event_id: createMode === 'existing' ? selectedEvent!.id : null,
      location_name: createMode === 'existing' ? selectedEvent!.location_name : (newLocation.trim() || null),
      location_address: createMode === 'existing' ? selectedEvent!.address : (newAddress.trim() || null),
      location_lat: createMode === 'existing' ? selectedEvent!.latitude : newLat,
      location_lng: createMode === 'existing' ? selectedEvent!.longitude : newLng,
      event_date: eventDate,
      notes: newNotes.trim() || null,
      visibility: 'private',
    };

    const { data: group, error } = await supabase
      .from('groups')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      setCreateError('Fehler beim Erstellen. Bitte versuche es erneut.');
      setCreating(false);
      return;
    }

    if (group) {
      // Add creator as owner with accepted RSVP
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'owner',
        rsvp: 'accepted',
        rsvp_at: new Date().toISOString(),
      });

      // Invite selected friends
      if (selectedFriends.length > 0) {
        await supabase.from('group_members').insert(
          selectedFriends.map(fid => ({
            group_id: group.id,
            user_id: fid,
            role: 'member',
            rsvp: 'pending',
          }))
        );

        // Notify friends
        await supabase.from('notifications').insert(
          selectedFriends.map(fid => ({
            user_id: fid,
            type: 'group_invite' as const,
            title: 'Event-Einladung',
            body: `Du wurdest zu "${insertData.name}" eingeladen`,
            from_user_id: user.id,
            group_id: group.id,
            action_url: `/groups/${group.id}`,
          }))
        );
      }

      // Activity
      await supabase.from('activities').insert({
        user_id: user.id,
        type: 'group_created',
        group_id: group.id,
        metadata: { name: insertData.name, event_type: insertData.event_type },
      });

      resetForm();
      router.push(`/groups/${group.id}`);
    }

    setCreating(false);
  };

  const resetForm = () => {
    setShowCreate(false);
    setCreateMode(null);
    setNewName('');
    setNewDesc('');
    setNewDate('');
    setNewTime('');
    setNewLocation('');
    setNewAddress('');
    setNewLat(null);
    setNewLng(null);
    setNewNotes('');
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setNewImage(null);
    setImagePreview(null);
    setEventSearch('');
    setEventResults([]);
    setSelectedEvent(null);
    setSelectedFriends([]);
    setFriendSearch('');
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
    const h = d.getHours();
    const m = d.getMinutes();
    if (h === 0 && m === 0) return date;
    return `${date}, ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'gerade eben';
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min.`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std.`;
    return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
  };

  const getMapThumbnail = (lat: number | null, lng: number | null) => {
    if (!lat || !lng) return null;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+a855f7(${lng},${lat})/${lng},${lat},13,0/200x120@2x?access_token=${token}`;
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

  const filteredFriends = friends.filter(f => {
    if (!friendSearch.trim()) return true;
    const q = friendSearch.toLowerCase();
    return f.first_name.toLowerCase().includes(q) || f.last_name.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white pb-24 bg-[#141416]">
      <SocialNav />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Event Planen</h1>
            <p className="text-white/40 text-sm mt-1">
              {events.length} {events.length === 1 ? 'geplantes Event' : 'geplante Events'}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all duration-200 flex items-center gap-2 active:scale-95 motion-reduce:transform-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neues Event planen
          </button>
          <ProfileDropdown />
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={resetForm}>
            <div
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mode selection */}
              {!createMode && (
                <>
                  <h2 className="text-lg font-bold mb-6">Was m&ouml;chtest du planen?</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setCreateMode('custom')}
                      className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/25 transition-all duration-200 text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3">
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <p className="font-medium text-sm">Eigenes Event</p>
                      <p className="text-xs text-white/30 mt-1">Homeparty, Grillabend, Ausflug...</p>
                    </button>
                    <button
                      onClick={() => setCreateMode('existing')}
                      className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/25 transition-all duration-200 text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <p className="font-medium text-sm">Bestehendes Event</p>
                      <p className="text-xs text-white/30 mt-1">Gemeinsam zu einem Event gehen</p>
                    </button>
                  </div>
                  <button
                    onClick={resetForm}
                    className="w-full mt-4 py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors"
                  >
                    Abbrechen
                  </button>
                </>
              )}

              {/* Custom Event Form */}
              {createMode === 'custom' && (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setCreateMode(null)} className="text-white/40 hover:text-white transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h2 className="text-lg font-bold">Eigenes Event erstellen</h2>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Eventname *</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="z.B. Grillabend bei Max"
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-white/30 focus-visible:ring-2 focus-visible:ring-white/20 transition-colors"
                        autoFocus
                      />
                    </div>

                    {/* Titelbild Upload */}
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Titelbild</label>
                      {imagePreview ? (
                        <div className="relative rounded-xl overflow-hidden border border-white/[0.06]">
                          <img src={imagePreview} alt="Vorschau" className="w-full h-32 object-cover" />
                          <button
                            type="button"
                            onClick={() => { setNewImage(null); setImagePreview(null); }}
                            className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/60 hover:text-white transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 w-full h-24 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-white/20 bg-white/[0.02] cursor-pointer transition-all duration-200 text-white/30 hover:text-white/50">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs">Bild hochladen</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setNewImage(file);
                                setImagePreview(URL.createObjectURL(file));
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Beschreibung</label>
                      <textarea
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="Was ist geplant?"
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">Datum</label>
                        <input
                          type="date"
                          value={newDate}
                          onChange={(e) => setNewDate(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-white/40 mb-1.5">Uhrzeit</label>
                        <input
                          type="time"
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <LocationAutocomplete
                      value={newLocation}
                      onChange={setNewLocation}
                      onSelect={(loc) => {
                        setNewLocation(loc.name);
                        setNewAddress(loc.address);
                        setNewLat(loc.lat);
                        setNewLng(loc.lng);
                      }}
                      label="Ort"
                      placeholder="Ort suchen oder eingeben..."
                    />

                    {/* Address details — shown after location is selected */}
                    {newAddress && (
                      <div className="space-y-3 pl-4 border-l-2 border-white/[0.06]">
                        <div>
                          <label className="block text-xs text-white/40 mb-1.5">Adresse</label>
                          <input
                            type="text"
                            value={newAddress}
                            onChange={(e) => setNewAddress(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                          />
                        </div>
                        {newLat && newLng && (
                          <p className="text-[11px] text-white/20 flex items-center gap-1.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Koordinaten erkannt
                          </p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Notizen (Anfahrt, Parking...)</label>
                      <textarea
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Parken hinter dem Haus..."
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                      />
                    </div>

                    {/* Invite friends */}
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Freunde einladen</label>
                      {friends.length > 6 && (
                        <input
                          type="text"
                          value={friendSearch}
                          onChange={(e) => setFriendSearch(e.target.value)}
                          placeholder="Freund suchen..."
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors mb-2"
                        />
                      )}
                      {friends.length === 0 ? (
                        <p className="text-xs text-white/20 py-2">Noch keine Freunde hinzugef&uuml;gt</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                          {filteredFriends.map(f => (
                            <button
                              key={f.id}
                              onClick={() => toggleFriend(f.id)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all duration-200 ${
                                selectedFriends.includes(f.id)
                                  ? 'bg-white text-black'
                                  : 'bg-white/[0.03] border border-white/[0.06] text-white/60 hover:border-white/20'
                              }`}
                            >
                              <Avatar url={f.avatar_url} name={f.first_name} />
                              {f.first_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {createError && (
                    <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {createError}
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={resetForm}
                      className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors text-sm"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={creating || !newName.trim()}
                      className="flex-1 py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center active:scale-95 motion-reduce:transform-none"
                    >
                      {creating ? (
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin motion-reduce:animate-none" />
                      ) : (
                        'Event erstellen'
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* Existing Event Form */}
              {createMode === 'existing' && (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setCreateMode(null)} className="text-white/40 hover:text-white transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <h2 className="text-lg font-bold">Gemeinsam zu einem Event</h2>
                  </div>

                  <div className="space-y-4">
                    {/* Event search */}
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Event suchen *</label>
                      {selectedEvent ? (
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/20">
                          {selectedEvent.image_url && (
                            <img src={selectedEvent.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{selectedEvent.title}</p>
                            <p className="text-xs text-white/30">
                              {formatDate(selectedEvent.start_date)}
                              {selectedEvent.location_name ? ` \u00B7 ${selectedEvent.location_name}` : ''}
                            </p>
                          </div>
                          <button
                            onClick={() => { setSelectedEvent(null); setEventSearch(''); }}
                            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            value={eventSearch}
                            onChange={(e) => setEventSearch(e.target.value)}
                            placeholder="Event suchen..."
                            className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                            autoFocus
                          />
                          {eventResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-[#111] border border-white/10 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                              {eventResults.map(e => (
                                <button
                                  key={e.id}
                                  onClick={() => { setSelectedEvent(e); setEventSearch(''); setEventResults([]); }}
                                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                                >
                                  {e.image_url && (
                                    <img src={e.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm truncate">{e.title}</p>
                                    <p className="text-xs text-white/30">
                                      {formatDate(e.start_date)}
                                      {e.location_name ? ` \u00B7 ${e.location_name}` : ''}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Beschreibung / Treffpunkt</label>
                      <textarea
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="Wir treffen uns vor dem Eingang..."
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Notizen (Anfahrt, Parking...)</label>
                      <textarea
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Parken am P3, Treffpunkt 18:00..."
                        rows={2}
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                      />
                    </div>

                    {/* Invite friends */}
                    <div>
                      <label className="block text-xs text-white/40 mb-1.5">Freunde einladen</label>
                      {friends.length > 6 && (
                        <input
                          type="text"
                          value={friendSearch}
                          onChange={(e) => setFriendSearch(e.target.value)}
                          placeholder="Freund suchen..."
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors mb-2"
                        />
                      )}
                      {friends.length === 0 ? (
                        <p className="text-xs text-white/20 py-2">Noch keine Freunde hinzugef&uuml;gt</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                          {filteredFriends.map(f => (
                            <button
                              key={f.id}
                              onClick={() => toggleFriend(f.id)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all duration-200 ${
                                selectedFriends.includes(f.id)
                                  ? 'bg-white text-black'
                                  : 'bg-white/[0.03] border border-white/[0.06] text-white/60 hover:border-white/20'
                              }`}
                            >
                              <Avatar url={f.avatar_url} name={f.first_name} />
                              {f.first_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {createError && (
                    <div className="mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                      {createError}
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={resetForm}
                      className="flex-1 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors text-sm"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={creating || !selectedEvent}
                      className="flex-1 py-3 rounded-xl bg-white text-black font-semibold hover:bg-white/90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center active:scale-95 motion-reduce:transform-none"
                    >
                      {creating ? (
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin motion-reduce:animate-none" />
                      ) : (
                        'Event planen'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Events List */}
        {loadingEvents ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden animate-pulse motion-reduce:animate-none">
                <div className="flex">
                  <div className="w-28 sm:w-36 shrink-0 bg-white/10 min-h-[100px]" />
                  <div className="flex-1 p-3.5 space-y-2">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-white/10 rounded w-1/2" />
                    <div className="h-3 bg-white/10 rounded w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm mb-1">Noch keine Events geplant</p>
            <p className="text-white/20 text-xs">Plane dein erstes Event mit Freunden</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => {
              const mapUrl = getMapThumbnail(ev.location_lat, ev.location_lng);
              return (
                <Link
                  key={ev.id}
                  href={`/groups/${ev.id}`}
                  className="block rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all duration-200 overflow-hidden group"
                >
                  <div className="flex">
                    {/* Map thumbnail or event image */}
                    <div className="w-28 sm:w-36 shrink-0 bg-white/5 relative">
                      {mapUrl ? (
                        <img src={mapUrl} alt="" className="w-full h-full object-cover" />
                      ) : ev.linked_event?.image_url || ev.image_url ? (
                        <img src={ev.linked_event?.image_url || ev.image_url || ''} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center min-h-[100px]">
                          <svg className="w-8 h-8 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                      )}
                      {/* Event type badge */}
                      <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm ${
                        ev.event_type === 'existing_event'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}>
                        {ev.event_type === 'existing_event' ? 'Event' : 'Eigenes'}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm truncate group-hover:text-white/90 transition-colors">
                            {ev.name}
                          </h3>
                          {ev.event_date && (
                            <p className="text-xs text-white/40 mt-0.5">{formatDateTime(ev.event_date)}</p>
                          )}
                          {ev.location_name && (
                            <p className="text-xs text-white/25 mt-0.5 truncate flex items-center gap-1">
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              {ev.location_name}
                            </p>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>

                      {/* RSVP status */}
                      <div className="flex items-center gap-2 mt-2.5">
                        <div className="flex items-center gap-1">
                          {ev.rsvp_counts.accepted > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400">
                              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                              {ev.rsvp_counts.accepted}
                            </span>
                          )}
                          {ev.rsvp_counts.maybe > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-400">
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" /></svg>
                              {ev.rsvp_counts.maybe}
                            </span>
                          )}
                          {ev.rsvp_counts.pending > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-white/10 text-white/30">
                              {ev.rsvp_counts.pending}
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </span>
                          )}
                        </div>

                        <span className="text-[10px] text-white/15">|</span>
                        <span className="text-[10px] text-white/20">{ev.member_count} Teilnehmer</span>
                      </div>

                      {/* Last message preview */}
                      {ev.last_message && (
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-[11px] text-white/20 truncate flex-1">{ev.last_message}</p>
                          {ev.last_message_at && (
                            <span className="text-[10px] text-white/15 shrink-0">{formatRelativeTime(ev.last_message_at)}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
