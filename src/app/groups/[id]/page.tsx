'use client';

/**
 * Plan detail view — the "inside" of a planned meetup.
 *
 * Layout (desktop, > md breakpoint):
 *   ┌─ Hero banner (image or map fallback) ──────────┐
 *   │   Title · date · location · RSVP buttons       │
 *   ├──────────┬──────────────────┬──────────────────┤
 *   │ Panel    │  Chat (tall)     │  Contributions   │
 *   │ Teiln.   │                  │  (Wer bringt)    │
 *   │ Stats    │                  │                  │
 *   ├──────────┴──────────────────┴──────────────────┤
 *   │              Pinwand (full-width)               │
 *   └─────────────────────────────────────────────────┘
 *
 * Mobile: single column stack of the same blocks.
 *
 * Data flow / state kept identical to the previous implementation —
 * only the presentation layer changed. Realtime chat + realtime
 * pinboard both subscribe independently.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { EventPreviewMessage } from '@/components/Chat/EventPreviewMessage';
import { EventSearchInline } from '@/components/Chat/EventSearchInline';
import { toast } from 'sonner';
import {
  PlanerShell,
  EditorialCaption,
  EditorialHeading,
  PlanerButton,
  PlanerInput,
  AvatarStack,
} from '@/components/Planer/primitives';
import { Pinboard } from '@/components/Planer/detail/Pinboard';
import { PlanSettingsDrawer } from '@/components/Planer/detail/PlanSettingsDrawer';
import { staggerContainer, riseItem, EASE_OUT_EXPO } from '@/components/Planer/motion';

// ──────────────────────────────────────────────────
// Types — unchanged from previous
// ──────────────────────────────────────────────────

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
  pinboard_permission: 'all_members' | 'owner_only' | 'specific_users';
  pinboard_allowed_users: string[] | null;
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

interface Activity {
  id: string;
  type: string;
  user_id: string;
  created_at: string;
  metadata: { rsvp?: string; label?: string; name?: string; event_type?: string; invited_user_id?: string } | null;
  profile?: { first_name: string; last_name: string };
}

interface MemoryItem {
  id: string;
  title: string | null;
  created_at: string;
  photo_count: number;
}

// ──────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────

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
  const [messageText, setMessageText] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [sending, setSending] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [myMembership, setMyMembership] = useState<Member | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [newContribution, setNewContribution] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [creatingMemory, setCreatingMemory] = useState(false);
  const [newMemoryTitle, setNewMemoryTitle] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showEventSearch, setShowEventSearch] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Auth gate ───
  useEffect(() => {
    if (!loading && !user) router.push('/auth/login');
  }, [loading, user, router]);

  // ─── Fetch all group-related data ───
  const fetchAll = useCallback(async () => {
    if (!user || !groupId) return;
    setLoadingData(true);

    const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).single();
    if (g) setGroup(g);

    const { data: mems } = await supabase
      .from('group_members')
      .select('id, user_id, role, rsvp, rsvp_at, profile:profiles(id, first_name, last_name, avatar_url, email)')
      .eq('group_id', groupId);
    if (mems) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized = mems.map((m: any) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      })) as Member[];
      setMembers(normalized);
      const me = normalized.find(m => m.user_id === user.id);
      if (me) setMyMembership(me);
    }

    if (g?.linked_event_id) {
      const { data: evt } = await supabase
        .from('events')
        .select('id, title, start_date, end_date, location_name, image_url, source_url, category')
        .eq('id', g.linked_event_id)
        .single();
      if (evt) setLinkedEvent(evt);
    }

    const { data: msgs } = await supabase
      .from('group_messages')
      .select('id, group_id, user_id, content, message_type, event_id, image_url, created_at, profile:profiles(first_name, last_name, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (msgs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMessages(msgs.map((m: any) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      })) as Message[]);
    }

    const { data: contribs } = await supabase
      .from('group_contributions')
      .select('id, user_id, item, created_at, profile:profiles(first_name, last_name, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    if (contribs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setContributions(contribs.map((c: any) => ({
        ...c,
        profile: Array.isArray(c.profile) ? c.profile[0] : c.profile,
      })) as Contribution[]);
    }

    // Activity log for this group
    const { data: acts } = await supabase
      .from('activities')
      .select('id, type, user_id, created_at, metadata, profile:profiles!activities_user_id_fkey(first_name, last_name)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (acts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setActivities(acts.map((a: any) => ({
        ...a,
        profile: Array.isArray(a.profile) ? a.profile[0] : a.profile,
      })) as Activity[]);
    }

    // Memories + photo counts
    const { data: mems2 } = await supabase
      .from('memories')
      .select('id, title, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (mems2) {
      const enriched = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    setLoadingData(false);
  }, [user, groupId, supabase]);

  useEffect(() => { if (user) fetchAll(); }, [user, fetchAll]);

  // ─── Scroll chat to bottom on new messages ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Realtime: messages ───
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`group-dash-${groupId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        async () => {
          const { data: msgs } = await supabase
            .from('group_messages')
            .select('id, group_id, user_id, content, message_type, event_id, image_url, created_at, profile:profiles(first_name, last_name, avatar_url)')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true })
            .limit(200);
          if (msgs) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setMessages(msgs.map((m: any) => ({
              ...m,
              profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
            })) as Message[]);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, supabase]);

  // ─── Actions ───
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
      await supabase.from('group_members')
        .update({ rsvp: status, rsvp_at: new Date().toISOString() })
        .eq('id', myMembership.id);

      const firstName = myMembership.profile?.first_name || 'Jemand';
      await Promise.all([
        supabase.from('activities').insert({
          user_id: user.id, type: 'group_joined', group_id: groupId,
          metadata: { rsvp: status, label: labels[status] || status },
        }),
        supabase.from('group_messages').insert({
          group_id: groupId, user_id: user.id,
          content: `${firstName} hat ${labels[status] || status}`, message_type: 'text',
        }),
      ]);

      setMyMembership(prev => prev ? { ...prev, rsvp: status, rsvp_at: new Date().toISOString() } : prev);
      const { data: mems } = await supabase
        .from('group_members')
        .select('id, user_id, role, rsvp, rsvp_at, profile:profiles(id, first_name, last_name, avatar_url, email)')
        .eq('group_id', groupId);
      if (mems) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setMembers(mems.map((m: any) => ({
          ...m,
          profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
        })) as Member[]);
      }
      toast.success(`Status: ${labels[status] || status}`);
    } catch {
      toast.error('RSVP konnte nicht aktualisiert werden');
    }
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
      await supabase.from('group_contributions').delete().eq('id', id);
      setContributions(prev => prev.filter(c => c.id !== id));
    } catch {
      toast.error('Eintrag konnte nicht entfernt werden');
    }
  };

  const leavePlan = async () => {
    if (!user || !myMembership) return;
    setLeaving(true);
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', myMembership.id);
      if (error) throw error;
      toast.success('Plan verlassen');
      router.replace('/groups');
    } catch (e) {
      console.error('[leave plan]', e);
      toast.error(e instanceof Error ? e.message : 'Verlassen fehlgeschlagen');
      setLeaving(false);
    }
  };

  const createMemory = async () => {
    const title = newMemoryTitle.trim();
    if (!user || !title) return;
    const { data, error } = await supabase
      .from('memories')
      .insert({ group_id: groupId, title })
      .select('id, title, created_at')
      .single();
    if (error) { toast.error('Erinnerung konnte nicht angelegt werden'); return; }
    if (data) {
      setMemories(prev => [{ ...data, photo_count: 0 }, ...prev]);
      setNewMemoryTitle('');
      setCreatingMemory(false);
      toast.success('Erinnerung angelegt');
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
  useEffect(() => () => { if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current); }, []);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      group_id: groupId, user_id: friendId, role: 'member', rsvp: 'pending',
    });
    await supabase.from('notifications').insert({
      user_id: friendId, type: 'group_invite', title: 'Event-Einladung',
      body: `Du wurdest zu "${group.name}" eingeladen`,
      from_user_id: user.id, group_id: groupId, action_url: `/groups/${groupId}`,
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

  // ─── Formatters ───
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const weekday = d.toLocaleDateString('de-AT', { weekday: 'long' });
    const date = d.toLocaleDateString('de-AT', { day: 'numeric', month: 'long' });
    const h = d.getHours();
    const m = d.getMinutes();
    if (h === 0 && m === 0) return `${weekday}, ${date}`;
    return `${weekday}, ${date} · ${d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}`;
  };
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  const formatRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'gerade';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
  };

  // ─── Derived ───
  const rsvpCounts = { accepted: 0, maybe: 0, declined: 0, pending: 0 };
  members.forEach(m => {
    if (m.rsvp === 'accepted') rsvpCounts.accepted++;
    else if (m.rsvp === 'maybe') rsvpCounts.maybe++;
    else if (m.rsvp === 'declined') rsvpCounts.declined++;
    else rsvpCounts.pending++;
  });

  const isOwner = group ? group.created_by === user?.id : false;
  const canPin = group ? (
    isOwner
    || group.pinboard_permission === 'all_members'
    || (group.pinboard_permission === 'specific_users'
        && !!user?.id
        && (group.pinboard_allowed_users ?? []).includes(user.id))
  ) : false;

  // Hero visual — image priority
  const heroImage = group?.image_url
    || linkedEvent?.image_url
    || (group?.location_lat && group?.location_lng
      ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-l+d0c9bd(${group.location_lng},${group.location_lat})/${group.location_lng},${group.location_lat},13,0/1600x700@2x?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''}`
      : null);

  // ─── Render ───
  if (loading || loadingData) {
    return (
      <PlanerShell>
        <div className="max-w-6xl mx-auto px-5 py-10">
          <div className="h-[360px] rounded-3xl bg-white/[0.03] animate-pulse mb-8" />
          <div className="grid md:grid-cols-[1fr_2fr_1fr] gap-5">
            <div className="h-60 rounded-2xl bg-white/[0.03] animate-pulse" />
            <div className="h-96 rounded-2xl bg-white/[0.03] animate-pulse" />
            <div className="h-60 rounded-2xl bg-white/[0.03] animate-pulse" />
          </div>
        </div>
      </PlanerShell>
    );
  }

  if (!group || !user) return null;

  return (
    <PlanerShell spotlight={false} grain={false}>
      {/* ══════════ HERO BANNER ══════════ */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
        className="relative overflow-hidden"
        style={{ minHeight: '360px' }}
      >
        {/* Background image or map */}
        {heroImage ? (
          <motion.div
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 2, ease: EASE_OUT_EXPO }}
            className="absolute inset-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt="" className="w-full h-full object-cover" />
          </motion.div>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 30% 40%, rgba(245,239,226,0.16), transparent 60%),
                           radial-gradient(ellipse at 70% 80%, rgba(120,112,98,0.12), transparent 60%),
                           linear-gradient(135deg, #0f0d0c 0%, #15120f 100%)`,
            }}
          />
        )}
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[color:var(--color-planer-void)] via-[color:var(--color-planer-void)]/70 to-[color:var(--color-planer-void)]/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[color:var(--color-planer-void)]/60 to-transparent" />

        {/* Top bar — back + type chip + invite code */}
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 pt-6 flex items-center justify-between gap-3">
          <Link
            href="/groups"
            className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" />
            </svg>
            Alle Pläne
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={copyInviteCode}
              className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-[color:var(--color-planer-void)]/80 backdrop-blur-md border border-white/10 text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] hover:border-white/20 transition-all"
              title="Einladungscode kopieren"
            >
              {copiedCode ? (
                <>
                  <svg className="w-3 h-3 text-[color:var(--color-planer-sage)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Kopiert
                </>
              ) : (
                <>
                  <span className="tabular text-[color:var(--color-planer-accent)]">{group.invite_code}</span>
                  <svg className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </>
              )}
            </button>

            {isOwner && (
              <>
                <button
                  onClick={loadFriendsForInvite}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-[color:var(--color-planer-void)]/80 backdrop-blur-md border border-white/10 text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] hover:border-white/20 transition-all"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Einladen
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  aria-label="Plan-Einstellungen"
                  title="Plan-Einstellungen"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--color-planer-void)]/80 backdrop-blur-md border border-white/10 text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] hover:border-white/20 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </>
            )}
            {!isOwner && myMembership && (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                aria-label="Plan verlassen"
                title="Plan verlassen"
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--color-planer-void)]/80 backdrop-blur-md border border-white/10 text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-rose)] hover:border-[color:var(--color-planer-rose)]/40 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Hero content — bottom-left anchored */}
        <div className="relative z-10 max-w-6xl mx-auto px-5 sm:px-8 pt-16 pb-10 sm:pt-24 sm:pb-14 flex flex-col gap-4">
          {/* Type badge */}
          <motion.div variants={riseItem} initial="hidden" animate="visible">
            <EditorialCaption>
              {group.event_type === 'existing_event' ? 'Öffentliches Event' : 'Privater Plan'}
            </EditorialCaption>
          </motion.div>

          <motion.div variants={riseItem} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
            <EditorialHeading size="hero" className="drop-shadow-lg max-w-3xl">
              {group.name}
            </EditorialHeading>
          </motion.div>

          <motion.div
            variants={riseItem}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[color:var(--color-planer-ink)]/85"
          >
            {group.event_date && (
              <span className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[color:var(--color-planer-accent)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2zm0 6h10v8H7v-8z" />
                </svg>
                {formatDateTime(group.event_date)}
              </span>
            )}
            {group.location_name && (
              <button
                onClick={openInMaps}
                className="flex items-center gap-2 hover:text-[color:var(--color-planer-accent)] transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-[color:var(--color-planer-accent)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a8 8 0 00-8 8c0 5.4 7 11.5 7.3 11.8.4.3.9.3 1.3 0C13 21.5 20 15.4 20 10a8 8 0 00-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z" />
                </svg>
                {group.location_name}
              </button>
            )}
          </motion.div>

          {/* RSVP buttons — only for invitees, not the owner */}
          {myMembership && !isOwner && (
            <motion.div
              variants={riseItem}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.3 }}
              className="mt-4 flex flex-wrap gap-2"
            >
              {(
                [
                  { value: 'accepted', label: 'Bin dabei', color: 'sage' },
                  { value: 'maybe', label: 'Vielleicht', color: 'maybe' },
                  { value: 'declined', label: 'Absage', color: 'rose' },
                ] as const
              ).map(opt => {
                const active = myMembership.rsvp === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateRsvp(opt.value)}
                    className={[
                      'px-4 py-2 rounded-full text-sm transition-all border',
                      active
                        ? `bg-[color:var(--color-planer-${opt.color})]/25 border-[color:var(--color-planer-${opt.color})] text-[color:var(--color-planer-ink)]`
                        : 'bg-[color:var(--color-planer-void)]/60 border-white/10 text-[color:var(--color-planer-dim)] hover:border-white/25 hover:text-[color:var(--color-planer-ink)]',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </motion.div>
          )}
        </div>
      </motion.section>

      {/* ══════════ MAIN ══════════ */}
      <main className="relative max-w-6xl mx-auto px-5 sm:px-8 py-10 pb-32">
        {/* Erinnerungen — wide horizontal strip directly below the hero,
            before the 3-col grid. Acts as a visual prelude: what this
            group has already produced together. */}
        <MemoriesSection
          memories={memories}
          creatingMemory={creatingMemory}
          setCreatingMemory={setCreatingMemory}
          newMemoryTitle={newMemoryTitle}
          setNewMemoryTitle={setNewMemoryTitle}
          onCreate={createMemory}
          formatRelative={formatRelativeTime}
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-[1fr_1.6fr_1fr] gap-5 mt-8"
        >
          {/* ─── LEFT — Participants panel ─── */}
          <motion.div variants={riseItem} className="rounded-2xl bg-[color:var(--color-planer-surface)] border border-white/[0.05] p-5 flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between mb-4">
              <EditorialCaption>Wer dabei ist</EditorialCaption>
              <span className="text-[10px] tabular text-[color:var(--color-planer-whisper)]">{String(members.length).padStart(2, '0')}</span>
            </div>

            {/* Mini stats grid */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <StatBlock value={rsvpCounts.accepted} label="dabei" tone="sage" />
              <StatBlock value={rsvpCounts.maybe} label="vielleicht" tone="maybe" />
              <StatBlock value={rsvpCounts.pending} label="offen" tone="dim" />
              <StatBlock value={rsvpCounts.declined} label="absage" tone="rose" />
            </div>

            {/* Member list (grouped subtly) */}
            <div className="space-y-1 text-sm overflow-y-auto flex-1 -mr-2 pr-2 custom-scrollbar">
              {members.slice(0, 12).map(m => (
                <div key={m.id} className="flex items-center gap-2.5 py-1.5">
                  <div className="relative">
                    {m.profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/60">
                        {m.profile.first_name[0]?.toUpperCase()}
                      </div>
                    )}
                    <span
                      className={[
                        'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[color:var(--color-planer-surface)]',
                        m.rsvp === 'accepted' ? 'bg-[color:var(--color-planer-sage)]'
                          : m.rsvp === 'maybe' ? 'bg-[color:var(--color-planer-maybe)]'
                          : m.rsvp === 'declined' ? 'bg-[color:var(--color-planer-rose)]'
                          : 'bg-white/20',
                      ].join(' ')}
                    />
                  </div>
                  <span className="truncate text-[color:var(--color-planer-ink)]">{m.profile.first_name}</span>
                  {m.role === 'owner' && (
                    <span className="text-[9px] uppercase tracking-[0.2em] text-[color:var(--color-planer-accent)]/70">Ersteller</span>
                  )}
                </div>
              ))}
              {members.length > 12 && (
                <div className="text-[10px] italic text-[color:var(--color-planer-whisper)] pt-2">
                  +{members.length - 12} mehr …
                </div>
              )}
            </div>
          </motion.div>

          {/* ─── CENTER — Chat ─── */}
          <motion.div variants={riseItem} className="rounded-2xl bg-[color:var(--color-planer-surface)] border border-white/[0.05] flex flex-col min-h-[520px] max-h-[620px]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
              <EditorialCaption>Gruppen-Chat</EditorialCaption>
              <button
                onClick={() => setShowEventSearch(true)}
                className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-planer-accent)]/70 hover:text-[color:var(--color-planer-accent)] transition-colors"
              >
                + Event teilen
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <p className="text-sm text-[color:var(--color-planer-dim)] italic max-w-xs mb-2">
                    „Die erste Nachricht bricht das Eis."
                  </p>
                  <p className="text-[11px] text-[color:var(--color-planer-whisper)]">
                    Frag wer was mitbringt, schreib wann ihr euch trefft.
                  </p>
                </div>
              ) : (
                messages.map(m => {
                  const isMine = m.user_id === user.id;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2`}>
                      {!isMine && (
                        <div className="w-7 h-7 shrink-0 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-[10px] text-white/60">
                          {m.profile?.avatar_url
                            ? <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                            : (m.profile?.first_name[0]?.toUpperCase() || '?')}
                        </div>
                      )}
                      <div className={`max-w-[76%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                        {!isMine && (
                          <span className="text-[10px] text-[color:var(--color-planer-whisper)] px-2">{m.profile?.first_name}</span>
                        )}
                        {m.message_type === 'event_share' && m.event_id ? (
                          <EventPreviewMessage eventId={m.event_id} isMe={isMine} />
                        ) : (
                          <div
                            className={[
                              'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
                              isMine
                                ? 'bg-[color:var(--color-planer-accent)]/15 text-[color:var(--color-planer-ink)] rounded-tr-sm'
                                : 'bg-white/[0.04] text-[color:var(--color-planer-ink)] rounded-tl-sm',
                            ].join(' ')}
                          >
                            {m.content}
                          </div>
                        )}
                        <span className="text-[9px] text-[color:var(--color-planer-whisper)] px-2">
                          {formatTime(m.created_at)} · {formatRelativeTime(m.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="border-t border-white/[0.05] p-3 flex items-center gap-2">
              <input
                type="text"
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Nachricht schreiben …"
                className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-[color:var(--color-planer-ink)] placeholder-[color:var(--color-planer-whisper)] outline-none transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={!messageText.trim() || sending}
                className="shrink-0 w-10 h-10 rounded-xl bg-[color:var(--color-planer-accent)] text-[color:var(--color-planer-void)] flex items-center justify-center disabled:opacity-40 transition-all active:scale-95"
                aria-label="Senden"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </motion.div>

          {/* ─── RIGHT — Contributions ─── */}
          <motion.div variants={riseItem} className="rounded-2xl bg-[color:var(--color-planer-surface)] border border-white/[0.05] p-5 flex flex-col min-h-[420px]">
            <div className="flex items-center justify-between mb-4">
              <EditorialCaption>Wer bringt was</EditorialCaption>
              <span className="text-[10px] tabular text-[color:var(--color-planer-whisper)]">{String(contributions.length).padStart(2, '0')}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 mb-3 -mr-2 pr-2 custom-scrollbar">
              {contributions.length === 0 ? (
                <p className="text-xs italic text-[color:var(--color-planer-whisper)]">
                  Chips, Getränke, Kohle — tragt ein was jeder mitbringt.
                </p>
              ) : (
                contributions.map(c => (
                  <div key={c.id} className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] text-white/60 shrink-0">
                      {c.profile?.first_name[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[color:var(--color-planer-ink)] truncate">{c.item}</p>
                      <p className="text-[9px] text-[color:var(--color-planer-whisper)]">{c.profile?.first_name}</p>
                    </div>
                    {c.user_id === user.id && (
                      <button
                        onClick={() => removeContribution(c.id)}
                        className="shrink-0 w-5 h-5 rounded-full text-[color:var(--color-planer-whisper)] hover:text-[color:var(--color-planer-rose)] opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                        aria-label="Entfernen"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Composer */}
            <div className="flex items-center gap-2">
              <PlanerInput
                type="text"
                value={newContribution}
                onChange={e => setNewContribution(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addContribution(); } }}
                placeholder="z. B. Kohle, Salat …"
                className="text-[13px] py-2"
              />
              <button
                onClick={addContribution}
                disabled={!newContribution.trim()}
                className="shrink-0 w-9 h-9 rounded-xl border border-[color:var(--color-planer-accent)]/30 text-[color:var(--color-planer-accent)] hover:border-[color:var(--color-planer-accent)]/60 hover:bg-[color:var(--color-planer-accent)]/10 disabled:opacity-40 transition-all flex items-center justify-center"
                aria-label="Hinzufügen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                </svg>
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* ══════════ PINBOARD ══════════ */}
        {/* ══════════ CHRONIK ══════════ */}
        <ChronikSection activities={activities} formatRelative={formatRelativeTime} />

        <Pinboard
          supabase={supabase}
          user={user}
          groupId={groupId}
          canCreate={canPin}
          isOwner={isOwner}
        />
      </main>

      {/* Event share modal (for chat) */}
      {showEventSearch && (
        <EventSearchInline
          onSelectEvent={shareEvent}
          onClose={() => setShowEventSearch(false)}
        />
      )}

      {/* Invite sheet */}
      {showInvite && (
        <InviteSheet
          friends={friends}
          invitingId={invitingId}
          onInvite={inviteFriend}
          onClose={() => setShowInvite(false)}
          inviteCode={group.invite_code}
          onCopyCode={copyInviteCode}
          copiedCode={copiedCode}
        />
      )}

      {/* Owner-only settings drawer (edit + delete plan) */}
      {isOwner && (
        <PlanSettingsDrawer
          open={showSettings}
          onClose={() => setShowSettings(false)}
          plan={group}
          supabase={supabase}
          user={user}
          invitedFriends={members
            .filter(m => m.user_id !== user.id && m.profile)
            .map(m => ({
              id: m.profile.id,
              first_name: m.profile.first_name,
              last_name: m.profile.last_name,
              avatar_url: m.profile.avatar_url,
            }))}
          onSaved={fetchAll}
        />
      )}

      {/* Leave-plan confirmation (non-owners) */}
      {showLeaveConfirm && !isOwner && (
        <LeavePlanDialog
          planName={group.name}
          leaving={leaving}
          onCancel={() => setShowLeaveConfirm(false)}
          onConfirm={leavePlan}
        />
      )}
    </PlanerShell>
  );
}

// ──────────────────────────────────────────────────
// LeavePlanDialog — small confirm modal for non-owners
// ──────────────────────────────────────────────────

function LeavePlanDialog({
  planName, leaving, onCancel, onConfirm,
}: {
  planName: string;
  leaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-[color:var(--color-planer-surface)] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="serif-display text-[22px] font-light text-[color:var(--color-planer-ink)] mb-2">
          Plan verlassen?
        </h3>
        <p className="text-sm text-[color:var(--color-planer-dim)] mb-6 leading-relaxed">
          Du verlässt „<span className="text-[color:var(--color-planer-ink)]">{planName}</span>" und siehst ihn
          nicht mehr in deiner Übersicht. Der Ersteller kann dich später wieder einladen.
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={leaving}
            className="text-sm text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] px-3 py-2 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={onConfirm}
            disabled={leaving}
            className="px-4 py-2 rounded-full bg-[color:var(--color-planer-rose)]/90 hover:bg-[color:var(--color-planer-rose)] text-white text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {leaving ? 'Verlasse …' : 'Ja, verlassen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────
// Small inline components
// ──────────────────────────────────────────────────

// ──────────────────────────────────────────────────
// MemoriesSection — photo albums linked to this plan
// ──────────────────────────────────────────────────

function MemoriesSection({
  memories, creatingMemory, setCreatingMemory,
  newMemoryTitle, setNewMemoryTitle, onCreate, formatRelative,
}: {
  memories: MemoryItem[];
  creatingMemory: boolean;
  setCreatingMemory: (v: boolean) => void;
  newMemoryTitle: string;
  setNewMemoryTitle: (s: string) => void;
  onCreate: () => void;
  formatRelative: (d: string) => string;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <EditorialCaption className="mb-1.5">Erinnerungen</EditorialCaption>
          <p className="text-xs text-[color:var(--color-planer-dim)] italic">
            Fotoalben aus eurem Treffen.
          </p>
        </div>
        {!creatingMemory && (
          <PlanerButton
            onClick={() => setCreatingMemory(true)}
            size="md"
            variant="outline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v14m7-7H5" />
            </svg>
            Album
          </PlanerButton>
        )}
      </div>

      {creatingMemory && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-3 p-3 rounded-2xl bg-[color:var(--color-planer-surface)] border border-white/[0.06] flex items-center gap-3"
        >
          <input
            type="text"
            value={newMemoryTitle}
            onChange={(e) => setNewMemoryTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onCreate(); }
              if (e.key === 'Escape') { setNewMemoryTitle(''); setCreatingMemory(false); }
            }}
            autoFocus
            placeholder="z. B. Der Abend am See"
            className="flex-1 bg-transparent border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-[color:var(--color-planer-ink)] placeholder-[color:var(--color-planer-whisper)] outline-none"
          />
          <button
            onClick={() => { setNewMemoryTitle(''); setCreatingMemory(false); }}
            className="text-xs text-[color:var(--color-planer-dim)] hover:text-[color:var(--color-planer-ink)] px-2"
          >
            Abbrechen
          </button>
          <PlanerButton
            onClick={onCreate}
            size="md"
            variant="primary"
            disabled={!newMemoryTitle.trim()}
          >
            Anlegen
          </PlanerButton>
        </motion.div>
      )}

      {/* Horizontal strip — always renders so the "Kein Album"-Tile is a
          compact call-to-create even when empty. Constant height so the
          page rhythm stays stable whether 0 or 20 albums exist. */}
      <div
        className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 sm:-mx-8 px-5 sm:px-8 pb-2"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {memories.length === 0 && !creatingMemory && (
          <button
            onClick={() => setCreatingMemory(true)}
            className="group shrink-0 w-[200px] h-[140px] rounded-2xl border border-dashed border-white/[0.12] hover:border-[color:var(--color-planer-accent)]/40 bg-white/[0.02] flex flex-col items-center justify-center gap-2 text-[color:var(--color-planer-whisper)] hover:text-[color:var(--color-planer-accent)]/80 transition-all"
            style={{ scrollSnapAlign: 'start' }}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="M3 17l5-5 4 4 3-3 6 6" />
            </svg>
            <span className="text-[11px] italic">
              Noch kein Album
            </span>
          </button>
        )}
        {memories.map(m => (
          <Link
            key={m.id}
            href={`/memories/${m.id}`}
            className="group relative shrink-0 w-[200px] h-[140px] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/20 bg-[color:var(--color-planer-surface)] flex flex-col transition-all"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="relative flex-1 overflow-hidden">
              <div
                className="absolute inset-0 transition-transform duration-[900ms] group-hover:scale-105"
                style={{
                  background: `radial-gradient(circle at 30% 30%, rgba(245,239,226,0.1), transparent 60%), linear-gradient(135deg, #15120f 0%, #1a1613 100%)`,
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-7 h-7 text-[color:var(--color-planer-whisper)]" fill="none" stroke="currentColor" strokeWidth={0.8} viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="9" cy="11" r="2" />
                  <path d="M3 17l5-5 4 4 3-3 6 6" />
                </svg>
              </div>
              <div className="absolute top-2 right-2 text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-planer-accent)]/70 bg-[color:var(--color-planer-void)]/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
                {m.photo_count}
              </div>
            </div>
            <div className="p-2.5 border-t border-white/[0.04]">
              <h4 className="serif-display font-light text-[color:var(--color-planer-ink)] text-[13px] leading-tight truncate">
                {m.title || 'Ohne Titel'}
              </h4>
              <p className="text-[9px] text-[color:var(--color-planer-whisper)] mt-0.5">
                {formatRelative(m.created_at)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────
// ChronikSection — activity log, editorial timeline
// ──────────────────────────────────────────────────

function ChronikSection({
  activities, formatRelative,
}: {
  activities: Activity[];
  formatRelative: (d: string) => string;
}) {
  if (activities.length === 0) return null;

  const describe = (a: Activity): string => {
    const name = a.profile?.first_name ?? 'Jemand';
    if (a.type === 'group_created') return `${name} hat den Plan erstellt`;
    if (a.type === 'group_joined') {
      if (a.metadata?.invited_user_id) return `${name} hat jemanden eingeladen`;
      if (a.metadata?.label) return `${name} hat ${a.metadata.label}`;
      if (a.metadata?.rsvp) return `${name} hat ${a.metadata.rsvp === 'accepted' ? 'zugesagt' : a.metadata.rsvp === 'maybe' ? 'vielleicht zugesagt' : 'abgesagt'}`;
      return `${name} ist der Gruppe beigetreten`;
    }
    return `${name}: ${a.type}`;
  };

  const iconFor = (a: Activity): string => {
    if (a.type === 'group_created') return 'M12 4v16m8-8H4';
    if (a.metadata?.invited_user_id) return 'M18 9v6m-3-3h6M12 12a4 4 0 100-8 4 4 0 000 8zM5 20v-1a6 6 0 016-6h1';
    if (a.metadata?.rsvp === 'accepted') return 'M5 13l4 4L19 7';
    if (a.metadata?.rsvp === 'declined') return 'M6 18L18 6M6 6l12 12';
    return 'M8 12h.01M12 12h.01M16 12h.01';
  };

  // Timeline convention: past on the left, newest on the right.
  // activities arrives newest-first, so we reverse for display.
  const chronological = [...activities].reverse();

  return (
    <section className="mt-10 mb-10">
      <div className="mb-5 flex items-baseline justify-between">
        <EditorialCaption>Chronik</EditorialCaption>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-planer-whisper)]">
          <span className="tabular">{String(chronological.length).padStart(2, '0')}</span>
          {' '}{chronological.length === 1 ? 'Ereignis' : 'Ereignisse'}
        </span>
      </div>

      {/* Horizontal timeline — bleeds into the page gutters so it reads as
          a continuous strip, scrolls horizontally if wider than viewport. */}
      <div className="relative overflow-x-auto scrollbar-hide -mx-5 sm:-mx-8 px-5 sm:px-8 py-2">
        <div className="relative flex min-w-max">
          {/* Continuous rule through all the dots — soft fade at both ends */}
          <div
            className="absolute top-[38px] left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.10] to-transparent"
            aria-hidden
          />
          {chronological.map((a) => (
            <div
              key={a.id}
              className="relative flex flex-col items-center gap-2 px-4 w-[140px] shrink-0"
            >
              {/* Description above the line (2-line clamp) */}
              <p
                className="text-[11px] text-[color:var(--color-planer-ink)]/75 text-center leading-snug h-[28px] overflow-hidden line-clamp-2 w-full"
              >
                {describe(a)}
              </p>
              {/* Node on the line */}
              <span className="relative z-10 w-[22px] h-[22px] rounded-full bg-[color:var(--color-planer-surface)] border border-white/[0.18] flex items-center justify-center text-[color:var(--color-planer-dim)]">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={iconFor(a)} />
                </svg>
              </span>
              {/* Time below */}
              <span className="text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-planer-whisper)]">
                {formatRelative(a.created_at)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatBlock({ value, label, tone }: { value: number; label: string; tone: 'sage' | 'maybe' | 'rose' | 'dim' }) {
  const color = {
    sage: 'var(--color-planer-sage)',
    maybe: 'var(--color-planer-maybe)',
    rose: 'var(--color-planer-rose)',
    dim: 'var(--color-planer-dim)',
  }[tone];
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 flex flex-col items-center justify-center">
      <span className="serif-display tabular text-[24px] leading-none font-light" style={{ color }}>{value}</span>
      <span className="text-[9px] uppercase tracking-[0.18em] text-[color:var(--color-planer-whisper)] mt-1">{label}</span>
    </div>
  );
}

function InviteSheet({
  friends, invitingId, onInvite, onClose, inviteCode, onCopyCode, copiedCode,
}: {
  friends: FriendProfile[];
  invitingId: string | null;
  onInvite: (id: string) => void;
  onClose: () => void;
  inviteCode: string;
  onCopyCode: () => void;
  copiedCode: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[color:var(--color-planer-surface)] border border-white/[0.08] rounded-t-2xl sm:rounded-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <EditorialCaption>Freunde einladen</EditorialCaption>
          <button onClick={onClose} className="text-[color:var(--color-planer-whisper)] hover:text-[color:var(--color-planer-ink)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Invite code block */}
        <button
          onClick={onCopyCode}
          className="w-full mb-5 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-[color:var(--color-planer-accent)]/30 transition-all flex items-center justify-between"
        >
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--color-planer-whisper)] mb-1">Einladungscode</div>
            <div className="serif-display tabular text-2xl text-[color:var(--color-planer-ink)]">{inviteCode}</div>
          </div>
          <span className="text-xs text-[color:var(--color-planer-accent)]">
            {copiedCode ? '✓ Kopiert' : 'Kopieren'}
          </span>
        </button>

        {friends.length === 0 ? (
          <p className="text-sm italic text-[color:var(--color-planer-dim)] text-center py-6">
            Alle deine Freunde sind schon dabei — oder es sind noch keine in deiner Liste.
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
            {friends.map(f => {
              const inviting = invitingId === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => onInvite(f.id)}
                  disabled={inviting}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors text-left disabled:opacity-50"
                >
                  {f.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm text-white/60">
                      {f.first_name[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 text-sm text-[color:var(--color-planer-ink)]">{f.first_name} {f.last_name}</span>
                  <span className="text-xs text-[color:var(--color-planer-accent)]">
                    {inviting ? '…' : 'Einladen'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
