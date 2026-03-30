'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { EventPreviewCard } from '@/components/Events/EventPreviewCard';

interface GroupData {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_by: string;
  invite_code: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
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

interface SharedEvent {
  id: string;
  event_id: string;
  shared_by: string;
  created_at: string;
  event: {
    id: string;
    title: string;
    start_date: string;
    location_name: string | null;
    image_url: string | null;
  };
  profile: {
    first_name: string;
    last_name: string;
  };
}

type Tab = 'chat' | 'events' | 'members';

export default function GroupDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  const supabase = createClient();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sharedEvents, setSharedEvents] = useState<SharedEvent[]>([]);
  const [tab, setTab] = useState<Tab>('chat');
  const [messageText, setMessageText] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [sending, setSending] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [myRole, setMyRole] = useState<string>('member');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showEventSearch, setShowEventSearch] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventSearchResults, setEventSearchResults] = useState<any[]>([]);
  const [searchingEvents, setSearchingEvents] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchGroup = useCallback(async () => {
    if (!user || !groupId) return;
    setLoadingData(true);

    const { data: g } = await supabase.from('groups').select('*').eq('id', groupId).single();
    if (g) setGroup(g);

    const { data: mems } = await supabase
      .from('group_members')
      .select('id, user_id, role, profile:profiles(id, first_name, last_name, avatar_url, email)')
      .eq('group_id', groupId);

    if (mems) {
      const normalized = mems.map((m: any) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      }));
      setMembers(normalized);
      const me = normalized.find((m: any) => m.user_id === user.id);
      if (me) setMyRole(me.role);
    }

    await fetchMessages();
    await fetchSharedEvents();
    setLoadingData(false);
  }, [user, groupId, supabase]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('group_messages')
      .select('id, group_id, user_id, content, message_type, event_id, image_url, created_at, profile:profiles(first_name, last_name, avatar_url)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) {
      setMessages(data.map((m: any) => ({
        ...m,
        profile: Array.isArray(m.profile) ? m.profile[0] : m.profile,
      })));
    }
  }, [groupId, supabase]);

  const fetchSharedEvents = useCallback(async () => {
    const { data } = await supabase
      .from('group_events')
      .select('id, event_id, shared_by, created_at, event:events(id, title, start_date, location_name, image_url), profile:profiles!group_events_shared_by_fkey(first_name, last_name)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (data) {
      setSharedEvents(data.map((e: any) => ({
        ...e,
        event: Array.isArray(e.event) ? e.event[0] : e.event,
        profile: Array.isArray(e.profile) ? e.profile[0] : e.profile,
      })));
    }
  }, [groupId, supabase]);

  useEffect(() => {
    if (user) fetchGroup();
  }, [user, fetchGroup]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for messages
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        async () => {
          await fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, supabase, fetchMessages]);

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

  const searchEvents = useCallback(async (query: string) => {
    if (!query.trim()) {
      setEventSearchResults([]);
      return;
    }
    setSearchingEvents(true);
    const { data } = await supabase
      .from('events')
      .select('id, title, start_date, location_name, image_url')
      .ilike('title', `%${query}%`)
      .limit(10);
    setEventSearchResults(data || []);
    setSearchingEvents(false);
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => searchEvents(eventSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [eventSearchQuery, searchEvents]);

  const shareEvent = async (eventId: string) => {
    if (!user) return;
    await supabase.from('group_events').insert({
      group_id: groupId,
      event_id: eventId,
      shared_by: user.id,
    });
    // Also send a chat message
    const event = eventSearchResults.find(e => e.id === eventId);
    if (event) {
      await supabase.from('group_messages').insert({
        group_id: groupId,
        user_id: user.id,
        content: `hat ein Event geteilt: ${event.title}`,
        message_type: 'event_share',
        event_id: eventId,
      });
    }
    setShowEventSearch(false);
    setEventSearchQuery('');
    setEventSearchResults([]);
    await fetchSharedEvents();
  };

  const copyInviteCode = () => {
    if (group) {
      navigator.clipboard.writeText(group.invite_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const promoteMember = async (memberId: string, newRole: string) => {
    setActionLoading(memberId);
    await supabase.from('group_members').update({ role: newRole }).eq('id', memberId);
    await fetchGroup();
    setActionLoading(null);
  };

  const removeMember = async (memberId: string) => {
    setActionLoading(memberId);
    await supabase.from('group_members').delete().eq('id', memberId);
    await fetchGroup();
    setActionLoading(null);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const Avatar = ({ url, name, size = 'sm' }: { url: string | null; name: string; size?: 'sm' | 'md' }) => {
    const s = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-10 h-10 text-sm';
    return url ? (
      <img src={url} alt="" className={`${s} rounded-full object-cover shrink-0`} />
    ) : (
      <div className={`${s} rounded-full bg-white/10 flex items-center justify-center font-semibold text-white/60 shrink-0`}>
        {name?.[0]?.toUpperCase() || '?'}
      </div>
    );
  };

  if (loading || !user || loadingData) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-white/40 mb-4">Gruppe nicht gefunden</p>
          <Link href="/groups" className="text-sm text-white/60 hover:text-white underline">Zur&uuml;ck zu Gruppen</Link>
        </div>
      </div>
    );
  }

  const tabItems: { key: Tab; label: string }[] = [
    { key: 'chat', label: 'Chat' },
    { key: 'events', label: 'Events' },
    { key: 'members', label: `Mitglieder (${members.length})` },
  ];

  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%), #000' }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <Link href="/groups" className="text-white/40 hover:text-white transition-colors text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Gruppen
        </Link>
        <div className="text-right">
          <p className="text-sm font-medium">{group.name}</p>
          <p className="text-[10px] text-white/30">{members.length} Mitglieder</p>
        </div>
      </header>

      {/* Group Info */}
      <div className="px-6 py-4 border-b border-white/10 shrink-0">
        <div className="max-w-2xl mx-auto">
          {group.description && (
            <p className="text-sm text-white/40 mb-2">{group.description}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-white/20">
            <span>Einladungscode:</span>
            <button
              onClick={copyInviteCode}
              className="font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10 hover:border-white/20 transition-colors"
            >
              {copiedCode ? 'Kopiert!' : group.invite_code}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-2 border-b border-white/10 shrink-0">
        <div className="max-w-2xl mx-auto flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
          {tabItems.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key ? 'bg-white text-black' : 'text-white/40 hover:text-white/60'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Tab */}
      {tab === 'chat' && (
        <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {messages.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm">Noch keine Nachrichten</p>
                <p className="text-white/15 text-xs mt-1">Schreibe die erste Nachricht!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.user_id === user.id;
                const isEventShare = msg.message_type === 'event_share' && msg.event_id;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && (
                      <Avatar url={msg.profile?.avatar_url} name={msg.profile?.first_name || ''} />
                    )}
                    <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && (
                        <p className="text-[10px] text-white/30 mb-0.5 px-1">
                          {msg.profile?.first_name} {msg.profile?.last_name}
                        </p>
                      )}
                      {isEventShare ? (
                        <EventPreviewCard
                          eventId={msg.event_id!}
                          isMe={isMe}
                          onViewDetail={(evt) => {
                            if (evt.source_url) window.open(evt.source_url, '_blank');
                          }}
                        />
                      ) : (
                        <div className={`px-3 py-2 rounded-2xl text-sm ${
                          isMe
                            ? 'bg-white text-black rounded-br-md'
                            : 'bg-white/10 text-white rounded-bl-md'
                        }`}>
                          {msg.content}
                        </div>
                      )}
                      <p className={`text-[10px] text-white/20 mt-0.5 px-1 ${isMe ? 'text-right' : ''}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="px-6 py-3 border-t border-white/10 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => setShowEventSearch(true)}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors shrink-0"
                title="Event teilen"
              >
                <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Nachricht schreiben..."
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !messageText.trim()}
                className="p-3 rounded-xl bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events Tab */}
      {tab === 'events' && (
        <div className="flex-1 overflow-y-auto px-6 py-4 max-w-2xl mx-auto w-full">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-white/40">{sharedEvents.length} Events geteilt</p>
            <button
              onClick={() => setShowEventSearch(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors"
            >
              Event teilen
            </button>
          </div>

          {sharedEvents.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-white/30 text-sm">Noch keine Events geteilt</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sharedEvents.map((se) => (
                <div key={se.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-white/10">
                    {se.event?.image_url ? (
                      <img src={se.event.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20 text-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{se.event?.title || 'Event'}</p>
                    <p className="text-xs text-white/30 mt-0.5">
                      {se.event?.start_date ? formatDate(se.event.start_date) : ''}
                      {se.event?.location_name ? ` - ${se.event.location_name}` : ''}
                    </p>
                    <p className="text-[10px] text-white/20 mt-0.5">
                      Geteilt von {se.profile?.first_name} {se.profile?.last_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="flex-1 overflow-y-auto px-6 py-4 max-w-2xl mx-auto w-full">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-white/40">{members.length} Mitglieder</p>
            <button
              onClick={copyInviteCode}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {copiedCode ? 'Kopiert!' : 'Einladungscode kopieren'}
            </button>
          </div>

          <div className="space-y-2">
            {members.map((m) => {
              const isOwner = myRole === 'owner';
              const isAdmin = myRole === 'admin' || isOwner;
              const canManage = isOwner && m.user_id !== user.id;
              const canRemove = isAdmin && m.role === 'member' && m.user_id !== user.id;

              const roleBadge = m.role === 'owner'
                ? { text: 'Ersteller', cls: 'bg-amber-400/20 text-amber-400' }
                : m.role === 'admin'
                ? { text: 'Admin', cls: 'bg-blue-400/20 text-blue-400' }
                : null;

              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
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
                    <p className="text-xs text-white/30 truncate">{m.profile?.email}</p>
                  </div>
                  {(canManage || canRemove) && (
                    <div className="flex items-center gap-1">
                      {canManage && m.role === 'member' && (
                        <button
                          onClick={() => promoteMember(m.id, 'admin')}
                          disabled={actionLoading === m.id}
                          className="text-[10px] px-2 py-1 rounded-lg text-white/30 hover:bg-white/10 hover:text-white/60 transition-colors disabled:opacity-50"
                        >
                          Zum Admin
                        </button>
                      )}
                      {canManage && m.role === 'admin' && (
                        <button
                          onClick={() => promoteMember(m.id, 'member')}
                          disabled={actionLoading === m.id}
                          className="text-[10px] px-2 py-1 rounded-lg text-white/30 hover:bg-white/10 hover:text-white/60 transition-colors disabled:opacity-50"
                        >
                          Entf. Admin
                        </button>
                      )}
                      {(canManage || canRemove) && (
                        <button
                          onClick={() => removeMember(m.id)}
                          disabled={actionLoading === m.id}
                          className="text-[10px] px-2 py-1 rounded-lg text-red-400/40 hover:bg-red-400/10 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          Entfernen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Event Search Modal */}
      {showEventSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => { setShowEventSearch(false); setEventSearchQuery(''); setEventSearchResults([]); }}>
          <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Event teilen</h2>
            <input
              type="text"
              value={eventSearchQuery}
              onChange={(e) => setEventSearchQuery(e.target.value)}
              placeholder="Event suchen..."
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors mb-4"
              autoFocus
            />
            {searchingEvents && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {eventSearchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {eventSearchResults.map((evt) => (
                  <button
                    key={evt.id}
                    onClick={() => shareEvent(evt.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/10">
                      {evt.image_url ? (
                        <img src={evt.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{evt.title}</p>
                      <p className="text-xs text-white/30 truncate">
                        {evt.start_date ? formatDate(evt.start_date) : ''}
                        {evt.location_name ? ` - ${evt.location_name}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {eventSearchQuery.trim() && !searchingEvents && eventSearchResults.length === 0 && (
              <p className="text-center text-white/30 text-sm py-4">Keine Events gefunden</p>
            )}
            <button
              onClick={() => { setShowEventSearch(false); setEventSearchQuery(''); setEventSearchResults([]); }}
              className="w-full mt-4 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
