'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { EventPreviewMessage } from '@/components/Chat/EventPreviewMessage';
import { EventSearchInline } from '@/components/Chat/EventSearchInline';
import { EventImage } from '@/components/Events/EventImage';
import { toast } from 'sonner';

interface GroupData {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_by: string;
  invite_code: string;
  event_type: string;
  linked_event_id: string | null;
  location_name: string | null;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  event_date: string | null;
  notes: string | null;
  visibility: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  rsvp: string;
  rsvp_at: string | null;
  profile: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    email: string;
  };
}

interface Message {
  id: string;
  group_id: string;
  user_id: string;
  content: string;
  message_type: string;
  event_id: string | null;
  image_url: string | null;
  created_at: string;
  profile: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

interface LinkedEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  image_url: string | null;
  source_url: string | null;
  category: string | null;
}

interface Activity {
  id: string;
  type: string;
  user_id: string;
  created_at: string;
  metadata: any;
  profile?: { first_name: string; last_name: string };
}

interface MemoryItem {
  id: string;
  title: string | null;
  created_at: string;
  photo_count: number;
}

interface FriendProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface Contribution {
  id: string;
  user_id: string;
  item: string;
  created_at: string;
  profile?: { first_name: string; last_name: string; avatar_url: string | null };
}

type Tab = 'overview' | 'teilnehmer' | 'memories' | 'aktivitaeten';

export default function EventDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  const supabase = createClient();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [linkedEvent, setLinkedEvent] = useState<LinkedEvent | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [messageText, setMessageText] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [sending, setSending] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [myMembership, setMyMembership] = useState<Member | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [newContribution, setNewContribution] = useState('');
  const [showEventSearch, setShowEventSearch] = useState(false);

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchAll = useCallback(async () => {
    if (!user || !groupId) return;
    setLoadingData(true);

    // Group data
    const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).single();
    if (g) {
      setGroup(g);
      setNotesText(g.notes || '');
    }

    // Members
    const { data: mems } = await supabase
      .from('group_members')
      .select('id, user_id, role, rsvp, rsvp_at, profile:profiles(id, first_name, last_name, avatar_url, email)')
      .eq('group_id', groupId);

    if (mems) {
      const normalized = mems.map((m: any) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      }));
      setMembers(normalized);
      const me = normalized.find((m: any) => m.user_id === user.id);
      if (me) setMyMembership(me);
    }

    // Linked event
    if (g?.linked_event_id) {
      const { data: evt } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, location_name, image_url, source_url, category')
        .eq('id', g.linked_event_id)
        .single();
      if (evt) setLinkedEvent(evt);
    }

    // Messages
    const { data: msgs } = await supabase
      .from('group_messages')
      .select('id, group_id, user_id, content, message_type, event_id, image_url, created_at, profile:profiles(first_name, last_name, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (msgs) {
      setMessages(msgs.map((m: any) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      })));
    }

    // Activities for this group
    const { data: acts } = await supabase
      .from('activities')
      .select('id, type, user_id, created_at, metadata, profile:profiles!activities_user_id_fkey(first_name, last_name)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (acts) {
      setActivities(acts.map((a: any) => ({
        ...a,
        profile: Array.isArray(a.profile) ? a.profile[0] : a.profile,
      })));
    }

    // Memories linked to this group
    const { data: mems2 } = await supabase
      .from('memories')
      .select('id, title, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (mems2) {
      const enriched = await Promise.all(
        mems2.map(async (m: any) => {
          const { count } = await supabase
            .from('memory_photos')
            .select('*', { count: 'exact', head: true })
            .eq('memory_id', m.id);
          return { ...m, photo_count: count || 0 };
        })
      );
      setMemories(enriched);
    }

    // Contributions (wer bringt was mit)
    const { data: contribs } = await supabase
      .from('group_contributions')
      .select('id, user_id, item, created_at, profile:profiles(first_name, last_name, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    if (contribs) {
      setContributions(contribs.map((c: any) => ({
        ...c,
        profile: Array.isArray(c.profile) ? c.profile[0] : c.profile,
      })));
    }

    setLoadingData(false);
  }, [user, groupId, supabase]);

  useEffect(() => {
    if (user) fetchAll();
  }, [user, fetchAll]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (tab === 'overview') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, tab]);

  // Realtime messages
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`group-dash-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, async () => {
        const { data: msgs } = await supabase
          .from('group_messages')
          .select('id, group_id, user_id, content, message_type, event_id, image_url, created_at, profile:profiles(first_name, last_name, avatar_url)')
          .eq('group_id', groupId)
          .order('created_at', { ascending: true })
          .limit(100);
        if (msgs) {
          setMessages(msgs.map((m: any) => ({ ...m, profile: Array.isArray(m.profile) ? m.profile[0] : m.profile })));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, supabase]);

  const sendMessage = async () => {
    if (!user || !messageText.trim()) return;
    setSending(true);
    await supabase.from('group_messages').insert({
      group_id: groupId,
      user_id: user.id,
      content: messageText.trim(),
      message_type: 'text',
    });
    setMessageText('');
    setSending(false);
  };

  const shareEvent = async (event: { id: string; title: string }) => {
    if (!user) return;
    await supabase.from('group_messages').insert({
      group_id: groupId,
      user_id: user.id,
      content: `Event geteilt: ${event.title}`,
      message_type: 'event_share',
      event_id: event.id,
    });
    setShowEventSearch(false);
  };

  const updateRsvp = async (status: string) => {
    if (!user || !myMembership) return;
    const labels: Record<string, string> = { accepted: 'zugesagt', maybe: 'vielleicht zugesagt', declined: 'abgesagt' };
    try {
      const { error } = await supabase.from('group_members')
        .update({ rsvp: status, rsvp_at: new Date().toISOString() })
        .eq('id', myMembership.id);
      if (error) throw error;

      // Activity + system chat message
      const firstName = myMembership.profile?.first_name || 'Jemand';
      await Promise.all([
        supabase.from('activities').insert({
          user_id: user.id,
          type: 'group_joined',
          group_id: groupId,
          metadata: { rsvp: status, label: labels[status] || status },
        }),
        supabase.from('group_messages').insert({
          group_id: groupId,
          user_id: user.id,
          content: `${firstName} hat ${labels[status] || status}`,
          message_type: 'text',
        }),
      ]);

      setMyMembership(prev => prev ? { ...prev, rsvp: status, rsvp_at: new Date().toISOString() } : prev);
      // Refresh members
      const { data: mems } = await supabase
        .from('group_members')
        .select('id, user_id, role, rsvp, rsvp_at, profile:profiles(id, first_name, last_name, avatar_url, email)')
        .eq('group_id', groupId);
      if (mems) {
        setMembers(mems.map((m: any) => ({ ...m, profile: Array.isArray(m.profile) ? m.profile[0] : m.profile })));
      }
      toast.success(`Status: ${labels[status] || status}`);
    } catch {
      toast.error('RSVP konnte nicht aktualisiert werden');
    }
  };

  const saveNotes = async () => {
    if (!group) return;
    await supabase.from('groups').update({ notes: notesText.trim() || null }).eq('id', group.id);
    setGroup(prev => prev ? { ...prev, notes: notesText.trim() || null } : prev);
    setEditingNotes(false);
  };

  const addContribution = async () => {
    if (!user || !newContribution.trim()) return;
    const { data } = await supabase
      .from('group_contributions')
      .insert({ group_id: groupId, user_id: user.id, item: newContribution.trim() })
      .select('id, user_id, item, created_at, profile:profiles(first_name, last_name, avatar_url)')
      .single();
    if (data) {
      const normalized = { ...data, profile: Array.isArray(data.profile) ? data.profile[0] : data.profile } as Contribution;
      setContributions(prev => [...prev, normalized]);
    }
    setNewContribution('');
  };

  const removeContribution = async (id: string) => {
    try {
      const { error } = await supabase.from('group_contributions').delete().eq('id', id);
      if (error) throw error;
      setContributions(prev => prev.filter(c => c.id !== id));
      toast.success('Eintrag entfernt');
    } catch {
      toast.error('Eintrag konnte nicht entfernt werden');
    }
  };

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyInviteCode = () => {
    if (group) {
      navigator.clipboard.writeText(group.invite_code);
      setCopiedCode(true);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopiedCode(false), 2000);
    }
  };
  useEffect(() => {
    return () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); };
  }, []);

  const loadFriendsForInvite = async () => {
    if (!user) return;
    const { data: accepted } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, first_name, last_name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, first_name, last_name, avatar_url)')
      .eq('status', 'accepted')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    if (!accepted) return;
    const memberIds = new Set(members.map(m => m.user_id));
    const friendsList: FriendProfile[] = accepted
      .map((f: any) => {
        const req = Array.isArray(f.requester) ? f.requester[0] : f.requester;
        const addr = Array.isArray(f.addressee) ? f.addressee[0] : f.addressee;
        return req?.id === user.id ? addr : req;
      })
      .filter((f: FriendProfile) => f && !memberIds.has(f.id));
    setFriends(friendsList);
    setShowInvite(true);
  };

  const inviteFriend = async (friendId: string) => {
    if (!user || !group) return;
    setInvitingId(friendId);
    await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: friendId,
      role: 'member',
      rsvp: 'pending',
    });
    await supabase.from('notifications').insert({
      user_id: friendId,
      type: 'group_invite',
      title: 'Event-Einladung',
      body: `Du wurdest zu "${group.name}" eingeladen`,
      from_user_id: user.id,
      group_id: groupId,
      action_url: `/groups/${groupId}`,
    });
    await supabase.from('activities').insert({
      user_id: user.id,
      type: 'group_joined',
      group_id: groupId,
      metadata: { invited_user_id: friendId, label: 'eingeladen' },
    });
    setFriends(prev => prev.filter(f => f.id !== friendId));
    setInvitingId(null);
    await fetchAll();
  };

  const openInMaps = () => {
    if (!group) return;
    const q = group.location_address || group.location_name || '';
    const lat = group.location_lat;
    const lng = group.location_lng;
    if (lat && lng) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
    } else if (q) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('de-AT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    const h = d.getHours();
    const m = d.getMinutes();
    if (h === 0 && m === 0) return date;
    return `${date} um ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'gerade eben';
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min.`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std.`;
    return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
  };

  const getMapStaticUrl = () => {
    if (!group?.location_lat || !group?.location_lng) return null;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-l+a855f7(${group.location_lng},${group.location_lat})/${group.location_lng},${group.location_lat},14,0/600x300@2x?access_token=${token}`;
  };

  const Avatar = ({ url, name, size = 'sm' }: { url: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) => {
    const s = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-xs';
    return url ? (
      <img src={url} alt="" className={`${s} rounded-full object-cover shrink-0`} />
    ) : (
      <div className={`${s} rounded-full bg-white/10 flex items-center justify-center font-semibold text-white/60 shrink-0`}>
        {name?.[0]?.toUpperCase() || '?'}
      </div>
    );
  };

  const isCreator = group?.created_by === user?.id;

  const rsvpButtons = [
    { value: 'accepted', label: 'Dabei', icon: 'M5 13l4 4L19 7', color: 'emerald' },
    { value: 'maybe', label: 'Vielleicht', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01', color: 'amber' },
    { value: 'declined', label: 'Kann nicht', icon: 'M6 18L18 6M6 6l12 12', color: 'red' },
  ] as const;

  const rsvpColorMap: Record<string, string> = {
    accepted: 'text-emerald-400',
    maybe: 'text-amber-400',
    declined: 'text-red-400',
    pending: 'text-white/30',
  };

  const rsvpBgMap: Record<string, string> = {
    accepted: 'bg-emerald-500/15',
    maybe: 'bg-amber-500/15',
    declined: 'bg-red-500/15',
    pending: 'bg-white/5',
  };

  if (loading || !user || loadingData) {
    return (
      <div className="min-h-screen text-white bg-surface">
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="h-4 bg-white/[0.06] rounded w-20 animate-pulse motion-reduce:animate-none" />
          <div className="h-4 bg-white/[0.06] rounded w-16 animate-pulse motion-reduce:animate-none" />
        </header>
        <div className="px-6 py-5 border-b border-white/[0.06]">
          <div className="max-w-2xl mx-auto space-y-3">
            <div className="h-3 bg-white/[0.06] rounded w-24 animate-pulse motion-reduce:animate-none" />
            <div className="h-6 bg-white/[0.06] rounded w-2/3 animate-pulse motion-reduce:animate-none" />
            <div className="h-4 bg-white/[0.06] rounded w-1/3 animate-pulse motion-reduce:animate-none" />
            <div className="flex gap-2 mt-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex-1 h-10 rounded-xl bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
              ))}
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-white/40 mb-4">Event nicht gefunden</p>
          <Link href="/groups" className="text-sm text-white/60 hover:text-white underline">Zur&uuml;ck</Link>
        </div>
      </div>
    );
  }

  const mapUrl = getMapStaticUrl();
  const acceptedMembers = members.filter(m => m.rsvp === 'accepted');
  const maybeMembers = members.filter(m => m.rsvp === 'maybe');
  const pendingMembers = members.filter(m => m.rsvp === 'pending');
  const declinedMembers = members.filter(m => m.rsvp === 'declined');

  const tabItems: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Dashboard' },
    { key: 'teilnehmer', label: `Teilnehmer (${members.length})` },
    { key: 'memories', label: 'Memories' },
    { key: 'aktivitaeten', label: 'Log' },
  ];

  return (
    <div className="min-h-screen text-white flex flex-col pb-20 bg-surface">
{/* Compact Header — event info + RSVP + tabs in one strip */}
      <header className="px-4 sm:px-6 py-3 border-b border-white/[0.06] shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* Top row: back + title + invite code */}
          <div className="flex items-center gap-3">
            <Link href="/groups" className="text-white/30 hover:text-white transition-colors shrink-0 p-1 -ml-1" aria-label="Zurück">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold truncate">{group.name}</h1>
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                  group.event_type === 'existing_event'
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-purple-500/15 text-purple-400'
                }`}>
                  {group.event_type === 'existing_event' ? 'Event' : 'Eigenes'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/30">
                {group.event_date && <span>{formatDateTime(group.event_date)}</span>}
                {group.event_date && group.location_name && <span>·</span>}
                {group.location_name && <span className="truncate">{group.location_name}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* RSVP compact */}
              {isCreator ? (
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Veranstalter
                </span>
              ) : (
                <div className="flex gap-1">
                  {rsvpButtons.map(btn => {
                    const isActive = myMembership?.rsvp === btn.value;
                    const colors: Record<string, string> = {
                      emerald: isActive ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-white/30 border-white/[0.06] hover:text-emerald-400',
                      amber: isActive ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-white/5 text-white/30 border-white/[0.06] hover:text-amber-400',
                      red: isActive ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 text-white/30 border-white/[0.06] hover:text-red-400',
                    };
                    return (
                      <button key={btn.value} onClick={() => updateRsvp(btn.value)} title={btn.label}
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all duration-200 active:scale-[0.92] motion-reduce:transform-none ${colors[btn.color]}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={btn.icon} />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              )}
              <button onClick={copyInviteCode} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/[0.06] text-white/30 hover:text-white hover:border-white/15 transition-colors" title="Einladungscode kopieren">
                {copiedCode ? 'Kopiert!' : group.invite_code}
              </button>
            </div>
          </div>

          {/* Tabs — inline under header */}
          <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {tabItems.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                tab === t.key ? 'bg-white text-black' : 'text-white/30 hover:text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* OVERVIEW TAB — Notion-style scrollable blocks */}
        {tab === 'overview' && (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">

            {/* Block 1: Map — wide, cinematic */}
            {mapUrl ? (
              <button onClick={openInMaps} className="relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden group active:scale-[0.99] motion-reduce:transform-none transition-transform duration-200">
                <img src={mapUrl} alt="Karte" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                      <span className="text-sm text-white/80 font-medium">{group.location_name}</span>
                    </div>
                    {group.location_address && <p className="text-xs text-white/40 ml-5">{group.location_address}</p>}
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-[10px] text-white/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 shrink-0">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    In Maps öffnen
                  </div>
                </div>
              </button>
            ) : (
              <div className="w-full h-32 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <div className="text-center text-white/10">
                  <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                  <p className="text-[10px]">Kein Standort hinterlegt</p>
                </div>
              </div>
            )}

            {/* Block 2: Chat (member-only) */}
            {myMembership ? (
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              {/* Messages area */}
              <div className="px-4 py-4 space-y-3" style={{ minHeight: '280px', maxHeight: '50vh', overflowY: 'auto' }}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-sm text-white/25">Schreib die erste Nachricht!</p>
                    <p className="text-xs text-white/10 mt-1">Plant euer Event gemeinsam</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = msg.user_id === user?.id;
                    const isEventShare = msg.message_type === 'event_share' && msg.event_id;
                    return (
                      <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} animate-[fadeIn_200ms_ease-out_both] motion-reduce:animate-none`}
                        style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
                        {!isMe && <Avatar url={msg.profile?.avatar_url || null} name={msg.profile?.first_name || '?'} size="sm" />}
                        <div className="max-w-[75%]">
                          {!isMe && <p className="text-[10px] text-white/30 mb-0.5 font-medium px-1">{msg.profile?.first_name}</p>}
                          {isEventShare ? (
                            <EventPreviewMessage eventId={msg.event_id!} isMe={isMe} />
                          ) : (
                            <div className={`px-3.5 py-2.5 rounded-2xl ${isMe ? 'rounded-br-md' : 'rounded-bl-md'} ${
                              isMe ? 'bg-white/[0.08] text-white/80' : 'bg-white/[0.03] border border-white/[0.06] text-white/70'
                            }`}>
                              <p className="text-[13px] leading-relaxed">{msg.content}</p>
                            </div>
                          )}
                          <p className="text-[9px] text-white/15 mt-1 text-right px-1">{new Date(msg.created_at).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              {/* Input bar */}
              <div className="border-t border-white/[0.06] px-3 py-2.5">
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEventSearch(true)}
                    className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-white/15 flex items-center justify-center transition-all duration-200 shrink-0"
                    title="Event teilen"
                  >
                    <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <input type="text" value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder="Nachricht schreiben..."
                    className="flex-1 px-4 py-2.5 min-h-[44px] rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/15 focus-visible:ring-2 focus-visible:ring-white/10 transition-all duration-200" />
                  <button onClick={sendMessage} disabled={sending || !messageText.trim()}
                    className="w-11 h-11 rounded-xl bg-white text-black flex items-center justify-center hover:bg-white/90 transition-all duration-200 disabled:opacity-20 disabled:cursor-not-allowed active:scale-[0.95] motion-reduce:transform-none shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </button>
                </div>
              </div>
            </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <p className="text-sm text-white/40 mb-1">Nur für Mitglieder</p>
                <p className="text-xs text-white/20 mb-4">Tritt der Gruppe bei, um den Chat und Beiträge zu sehen.</p>
                <button onClick={() => updateRsvp('accepted')} className="px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all duration-200 active:scale-[0.97] motion-reduce:transform-none">
                  Beitreten
                </button>
              </div>
            )}

            {/* Block 3: Widgets — side by side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Teilnehmer */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="text-xs font-medium text-white/30">{members.length} Teilnehmer</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { n: acceptedMembers.length, l: 'Dabei', c: 'emerald' },
                    { n: maybeMembers.length, l: 'Vielleicht', c: 'amber' },
                    { n: pendingMembers.length, l: 'Offen', c: 'white' },
                    { n: declinedMembers.length, l: 'Absage', c: 'red' },
                  ].map((s, i) => (
                    <div key={i} className={`text-center py-2.5 rounded-xl ${
                      s.c === 'emerald' ? 'bg-emerald-500/8' : s.c === 'amber' ? 'bg-amber-500/8' : s.c === 'red' ? 'bg-red-500/8' : 'bg-white/[0.03]'
                    }`}>
                      <p className={`text-lg font-bold ${
                        s.c === 'emerald' ? 'text-emerald-400' : s.c === 'amber' ? 'text-amber-400' : s.c === 'red' ? 'text-red-400' : 'text-white/20'
                      }`}>{s.n}</p>
                      <p className={`text-[10px] ${
                        s.c === 'emerald' ? 'text-emerald-400/50' : s.c === 'amber' ? 'text-amber-400/50' : s.c === 'red' ? 'text-red-400/50' : 'text-white/15'
                      }`}>{s.l}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wer bringt was mit? */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
                  <svg className="w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  <span className="text-xs font-medium text-white/30">Wer bringt was mit?</span>
                </div>
                <div className="px-4 py-3 space-y-1.5 max-h-40 overflow-y-auto">
                  {contributions.length === 0 ? (
                    <p className="text-xs text-white/15 text-center py-4">Noch keine Einträge</p>
                  ) : contributions.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2 group animate-[fadeIn_200ms_ease-out_both] motion-reduce:animate-none" style={{ animationDelay: `${i * 30}ms` }}>
                      <Avatar url={c.profile?.avatar_url || null} name={c.profile?.first_name || '?'} size="sm" />
                      <span className="text-xs text-white/50 truncate flex-1">{c.item}</span>
                      {c.user_id === user?.id && (
                        <button onClick={() => removeContribution(c.id)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/30 hover:text-red-400 transition-all duration-150 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 shrink-0" aria-label="Eintrag entfernen">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {myMembership && (
                <div className="flex gap-2 px-3 py-2.5 border-t border-white/[0.04]">
                  <input type="text" value={newContribution} onChange={(e) => setNewContribution(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addContribution(); } }}
                    placeholder="z.B. Chips, Getränke..."
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.04] text-xs text-white placeholder-white/15 focus:outline-none focus:border-white/15 transition-colors min-h-[36px]" />
                  <button onClick={addContribution} disabled={!newContribution.trim()}
                    className="w-9 h-9 rounded-lg bg-white/[0.06] text-white/40 flex items-center justify-center hover:bg-white/10 transition-all duration-150 disabled:opacity-20 active:scale-[0.95] motion-reduce:transform-none">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>
                )}
              </div>
            </div>

            {/* Block 4: Notizen (nur wenn vorhanden oder Creator) */}
            {(group.notes || isCreator) && (
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span className="text-xs font-medium text-white/30">Notizen / Anfahrt</span>
                  </div>
                  {isCreator && !editingNotes && (
                    <button onClick={() => setEditingNotes(true)} className="text-[10px] text-white/20 hover:text-white/50 transition-colors">Bearbeiten</button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2.5">
                    <textarea value={notesText} onChange={(e) => setNotesText(e.target.value)} rows={4} placeholder="Anfahrt, Parken..."
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/15 transition-colors resize-none" autoFocus />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditingNotes(false); setNotesText(group.notes || ''); }} className="px-3 py-1.5 text-xs text-white/30 hover:text-white transition-colors">Abbrechen</button>
                      <button onClick={saveNotes} className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors active:scale-[0.97] motion-reduce:transform-none">Speichern</button>
                    </div>
                  </div>
                ) : group.notes ? (
                  <p className="text-sm text-white/40 whitespace-pre-wrap leading-relaxed">{group.notes}</p>
                ) : (
                  <p className="text-xs text-white/15">Noch keine Notizen — klicke Bearbeiten um Infos hinzuzufügen</p>
                )}
              </div>
            )}

            {/* Block 5: Linked Event (wenn vorhanden) */}
            {linkedEvent && (
              <Link href={`/events/${linkedEvent.id}`} className="block rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 hover:border-white/15 transition-colors">
                <div className="flex items-center gap-3">
                  <EventImage
                    src={linkedEvent.image_url}
                    category={linkedEvent.category}
                    title={linkedEvent.title}
                    className="w-full h-full"
                    wrapperClassName="w-14 h-14 rounded-xl shrink-0"
                    showSkeleton={false}
                    loading="lazy"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white/20 uppercase tracking-wider mb-0.5">Verknüpftes Event</p>
                    <p className="text-sm font-medium truncate">{linkedEvent.title}</p>
                    <p className="text-xs text-white/30">{formatDate(linkedEvent.start_date)}{linkedEvent.location_name ? ` · ${linkedEvent.location_name}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {linkedEvent.source_url && (
                      <a href={linkedEvent.source_url} target="_blank" rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/[0.06] text-xs text-white/40 hover:text-white hover:border-white/15 transition-all duration-200 min-h-[36px] flex items-center">
                        Original-Quelle
                      </a>
                    )}
                    <svg className="w-4 h-4 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* TEILNEHMER TAB */}
        {tab === 'teilnehmer' && (
          <div className="max-w-2xl mx-auto px-6 py-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-white/40">{members.length} Teilnehmer</p>
              <button
                onClick={loadFriendsForInvite}
                className="px-3 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 transition-all duration-200 flex items-center gap-1.5 active:scale-95 motion-reduce:transform-none"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Einladen
              </button>
            </div>

            {/* Grouped by RSVP status */}
            {[
              { label: 'Dabei', members: acceptedMembers, color: 'emerald' },
              { label: 'Vielleicht', members: maybeMembers, color: 'amber' },
              { label: 'Ausstehend', members: pendingMembers, color: 'white' },
              { label: 'Kann nicht', members: declinedMembers, color: 'red' },
            ].filter(g => g.members.length > 0).map(grp => (
              <div key={grp.label} className="mb-5">
                <p className={`text-xs font-medium mb-2 ${
                  grp.color === 'emerald' ? 'text-emerald-400/60' :
                  grp.color === 'amber' ? 'text-amber-400/60' :
                  grp.color === 'red' ? 'text-red-400/60' :
                  'text-white/25'
                }`}>{grp.label} ({grp.members.length})</p>
                <div className="space-y-1.5">
                  {grp.members.map(m => {
                    const roleBadge = m.role === 'owner'
                      ? { text: 'Ersteller', cls: 'bg-amber-400/20 text-amber-400' }
                      : m.role === 'admin'
                      ? { text: 'Admin', cls: 'bg-blue-400/20 text-blue-400' }
                      : null;

                    return (
                      <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10">
                        <Avatar url={m.profile?.avatar_url} name={m.profile?.first_name || ''} size="md" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{m.profile?.first_name} {m.profile?.last_name}</p>
                            {roleBadge && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleBadge.cls}`}>
                                {roleBadge.text}
                              </span>
                            )}
                          </div>
                          {m.rsvp_at && (
                            <p className="text-[10px] text-white/20">{formatRelativeTime(m.rsvp_at)}</p>
                          )}
                        </div>
                        <div className={`w-2 h-2 rounded-full ${
                          m.rsvp === 'accepted' ? 'bg-emerald-400' :
                          m.rsvp === 'maybe' ? 'bg-amber-400' :
                          m.rsvp === 'declined' ? 'bg-red-400' :
                          'bg-white/20'
                        }`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MEMORIES TAB */}
        {tab === 'memories' && (
          <div className="max-w-2xl mx-auto px-6 py-6">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-white/40">{memories.length} Memories</p>
              <Link
                href={`/memories?group=${groupId}`}
                className="px-3 py-2 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 transition-all duration-200 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Memory erstellen
              </Link>
            </div>

            {memories.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm">Noch keine Memories</p>
                <p className="text-white/15 text-xs mt-1">Erstelle nach dem Event ein Memory mit Fotos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {memories.map(m => (
                  <Link
                    key={m.id}
                    href={`/memories/${m.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.title || 'Memory'}</p>
                      <p className="text-xs text-white/30">{formatDate(m.created_at)} &middot; {m.photo_count} Fotos</p>
                    </div>
                    <svg className="w-4 h-4 text-white/10 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AKTIVITAETEN TAB */}
        {tab === 'aktivitaeten' && (
          <div className="max-w-2xl mx-auto px-6 py-6">
            {activities.length === 0 ? (
              <p className="text-center text-white/30 text-sm py-12">Noch keine Aktivit&auml;ten</p>
            ) : (
              <div className="space-y-0 relative before:absolute before:left-4 before:top-0 before:bottom-0 before:w-px before:bg-white/10">
                {activities.map(a => {
                  const meta = a.metadata || {};
                  let text = '';
                  if (a.type === 'group_created') text = 'hat das Event erstellt';
                  else if (a.type === 'group_joined' && meta.label === 'eingeladen') text = `hat jemanden eingeladen`;
                  else if (a.type === 'group_joined') text = `hat ${meta.label || 'reagiert'}`;
                  else text = a.type;

                  return (
                    <div key={a.id} className="flex gap-4 pl-10 py-2 relative">
                      <div className="absolute left-2.5 top-4 w-3 h-3 rounded-full bg-white/10 border-2 border-black" />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="text-white/60">{a.profile?.first_name} {a.profile?.last_name}</span>
                          <span className="text-white/30"> {text}</span>
                        </p>
                        <p className="text-[10px] text-white/15 mt-0.5">{formatRelativeTime(a.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-md bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Freunde einladen</h2>
            {friends.length === 0 ? (
              <p className="text-sm text-white/30 py-8 text-center">Keine weiteren Freunde zum Einladen</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {friends.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <Avatar url={f.avatar_url} name={f.first_name} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.first_name} {f.last_name}</p>
                    </div>
                    <button
                      onClick={() => inviteFriend(f.id)}
                      disabled={invitingId === f.id}
                      className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                    >
                      {invitingId === f.id ? '...' : 'Einladen'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowInvite(false)}
              className="w-full mt-4 py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Schlie&szlig;en
            </button>
          </div>
        </div>
      )}

      {/* Event Search Modal */}
      {showEventSearch && (
        <EventSearchInline
          onSelectEvent={shareEvent}
          onClose={() => setShowEventSearch(false)}
        />
      )}
    </div>
  );
}
