'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { EventPreviewCard } from '@/components/Events/EventPreviewCard';

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: string;
  event_id: string | null;
  read: boolean;
  created_at: string;
}

interface FriendProfile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export default function DMConversationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const friendId = params.userId as string;
  const supabase = createClient();

  const [friend, setFriend] = useState<FriendProfile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loadingData, setLoadingData] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEventSearch, setShowEventSearch] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventSearchResults, setEventSearchResults] = useState<any[]>([]);
  const [searchingEvents, setSearchingEvents] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchFriend = useCallback(async () => {
    if (!friendId) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .eq('id', friendId)
      .single();
    if (data) setFriend(data);
  }, [friendId, supabase]);

  const fetchMessages = useCallback(async () => {
    if (!user || !friendId) return;

    const { data } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(200);

    if (data) setMessages(data);
  }, [user, friendId, supabase]);

  const markAsRead = useCallback(async () => {
    if (!user || !friendId) return;
    await supabase
      .from('direct_messages')
      .update({ read: true })
      .eq('sender_id', friendId)
      .eq('receiver_id', user.id)
      .eq('read', false);
  }, [user, friendId, supabase]);

  useEffect(() => {
    if (user && friendId) {
      const init = async () => {
        setLoadingData(true);
        await fetchFriend();
        await fetchMessages();
        await markAsRead();
        setLoadingData(false);
      };
      init();
    }
  }, [user, friendId, fetchFriend, fetchMessages, markAsRead]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !friendId) return;

    const channel = supabase
      .channel(`dm-${[user.id, friendId].sort().join('-')}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        async (payload) => {
          const msg = payload.new as DirectMessage;
          if (
            (msg.sender_id === user.id && msg.receiver_id === friendId) ||
            (msg.sender_id === friendId && msg.receiver_id === user.id)
          ) {
            setMessages(prev => [...prev, msg]);
            if (msg.sender_id === friendId) {
              await markAsRead();
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, friendId, supabase, markAsRead]);

  const sendMessage = async () => {
    if (!user || !messageText.trim()) return;
    setSending(true);
    await supabase.from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: friendId,
      content: messageText.trim(),
      message_type: 'text',
      read: false,
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

  const shareEvent = async (event: any) => {
    if (!user) return;
    await supabase.from('direct_messages').insert({
      sender_id: user.id,
      receiver_id: friendId,
      content: `Event geteilt: ${event.title}`,
      message_type: 'event_share',
      event_id: event.id,
      read: false,
    });
    setShowEventSearch(false);
    setEventSearchQuery('');
    setEventSearchResults([]);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDateSeparator = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Heute';
    if (d.toDateString() === yesterday.toDateString()) return 'Gestern';
    return d.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // Group messages by date
  const groupedMessages: { date: string; messages: DirectMessage[] }[] = [];
  let currentDate = '';
  for (const msg of messages) {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== currentDate) {
      currentDate = msgDate;
      groupedMessages.push({ date: msg.created_at, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 60%), #000' }}
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-white/10 shrink-0">
        <Link href="/messages" className="text-white/40 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {friend && (
          <div className="flex items-center gap-3">
            {friend.avatar_url ? (
              <img src={friend.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/60">
                {friend.first_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{friend.first_name} {friend.last_name}</p>
            </div>
          </div>
        )}
      </header>

      {/* Messages */}
      {loadingData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-white/30 text-sm">Noch keine Nachrichten</p>
              <p className="text-white/15 text-xs mt-1">Sag Hallo!</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {groupedMessages.map((group, gi) => (
                <div key={gi}>
                  {/* Date separator */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] text-white/20 uppercase tracking-wider">
                      {formatDateSeparator(group.date)}
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* Messages in this date group */}
                  <div className="space-y-2">
                    {group.messages.map((msg) => {
                      const isMe = msg.sender_id === user.id;
                      const isEventShare = msg.message_type === 'event_share' && msg.event_id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%]`}>
                            {isEventShare ? (
                              <EventPreviewCard
                                eventId={msg.event_id!}
                                isMe={isMe}
                                onViewDetail={(evt) => {
                                  if (evt.source_url) window.open(evt.source_url, '_blank');
                                }}
                              />
                            ) : (
                              <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                                isMe
                                  ? 'bg-white text-black rounded-br-md'
                                  : 'bg-white/10 text-white rounded-bl-md'
                              }`}>
                                {msg.content}
                              </div>
                            )}
                            <p className={`text-[10px] text-white/20 mt-0.5 px-1 ${isMe ? 'text-right' : ''}`}>
                              {formatTime(msg.created_at)}
                              {isMe && msg.read && <span className="ml-1 text-white/30">gelesen</span>}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      )}

      {/* Message Input */}
      <div className="px-6 py-3 border-t border-white/10 shrink-0">
        <div className="max-w-2xl mx-auto flex gap-2">
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
                    onClick={() => shareEvent(evt)}
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
