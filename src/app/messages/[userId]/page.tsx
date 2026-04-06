'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { EventPreviewMessage } from '@/components/Chat/EventPreviewMessage';
import { EventSearchInline } from '@/components/Chat/EventSearchInline';
import { toast } from 'sonner';

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
  const [isFriend, setIsFriend] = useState<boolean | null>(null); // null = loading
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false);
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

  const checkFriendship = useCallback(async () => {
    if (!user || !friendId) return;
    const { data } = await supabase
      .from('friendships')
      .select('id')
      .eq('status', 'accepted')
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`)
      .limit(1);
    setIsFriend((data && data.length > 0) || false);
  }, [user, friendId, supabase]);

  const sendFriendRequest = async () => {
    if (!user || !friendId) return;
    setSendingFriendRequest(true);
    try {
      const { error } = await supabase.from('friendships').insert({
        requester_id: user.id,
        addressee_id: friendId,
        status: 'pending',
      });
      if (error) throw error;
      toast.success('Freundschaftsanfrage gesendet');
    } catch {
      toast.error('Anfrage konnte nicht gesendet werden');
    } finally {
      setSendingFriendRequest(false);
    }
  };

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
        await checkFriendship();
        await fetchMessages();
        await markAsRead();
        setLoadingData(false);
      };
      init();
    }
  }, [user, friendId, fetchFriend, checkFriendship, fetchMessages, markAsRead]);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (payload: any) => {
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
    try {
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: friendId,
        content: messageText.trim(),
        message_type: 'text',
        read: false,
      });
      if (error) throw error;
      setMessageText('');
    } catch {
      toast.error('Nachricht konnte nicht gesendet werden');
    } finally {
      setSending(false);
    }
  };

  const shareEvent = async (event: { id: string; title: string }) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: friendId,
        content: `Event geteilt: ${event.title}`,
        message_type: 'event_share',
        event_id: event.id,
        read: false,
      });
      if (error) throw error;
      setShowEventSearch(false);
    } catch {
      toast.error('Event konnte nicht geteilt werden');
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-inset text-white flex flex-col">
        <header className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06] shrink-0 bg-surface-elevated">
          <div className="w-5 h-5 rounded bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
          <div className="w-9 h-9 rounded-full bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-24 rounded bg-white/[0.06] animate-pulse motion-reduce:animate-none" />
        </header>
        <div className="flex-1 px-6 py-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
              <div className={`h-10 rounded-2xl bg-white/[0.06] animate-pulse motion-reduce:animate-none ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} style={{ animationDelay: `${i * 80}ms` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white flex flex-col bg-surface-inset"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.06] shrink-0 bg-surface-elevated">
        <Link href="/messages" className="text-white/30 hover:text-white/60 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {friend && (
          <div className="flex items-center gap-3">
            {friend.avatar_url ? (
              <img src={friend.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/50">
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
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          {messages.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-white/40 text-sm">Noch keine Nachrichten</p>
              <p className="text-white/30 text-xs mt-1">Sag Hallo!</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-4">
              {groupedMessages.map((group, gi) => (
                <div key={gi}>
                  {/* Date separator */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">
                      {formatDateSeparator(group.date)}
                    </span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>

                  {/* Messages in this date group */}
                  <div className="space-y-2">
                    {group.messages.map((msg) => {
                      const isMe = msg.sender_id === user?.id;
                      const isEventShare = msg.message_type === 'event_share' && msg.event_id;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%]`}>
                            {isEventShare ? (
                              <EventPreviewMessage
                                eventId={msg.event_id!}
                                isMe={isMe}
                              />
                            ) : (
                              <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                                isMe
                                  ? 'bg-indigo-500 text-white rounded-br-md'
                                  : 'bg-white/[0.06] text-white/90 border border-white/[0.10] rounded-bl-md'
                              }`}>
                                {msg.content}
                              </div>
                            )}
                            <p className={`text-[10px] text-white/30 mt-0.5 px-1 ${isMe ? 'text-right' : ''}`}>
                              {formatTime(msg.created_at)}
                              {isMe && msg.read && <span className="ml-1 text-white/40">gelesen</span>}
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

      {/* Message Input or Friend Guard */}
      {isFriend === false ? (
        <div className="px-6 py-4 border-t border-white/[0.06] shrink-0 bg-surface-elevated">
          <div className="max-w-2xl mx-auto text-center py-4">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-white/50 text-sm mb-1">Ihr muesst Freunde sein um Nachrichten zu senden</p>
            <p className="text-white/30 text-xs mb-3">Sende eine Freundschaftsanfrage, um eine Unterhaltung zu starten.</p>
            <button
              onClick={sendFriendRequest}
              disabled={sendingFriendRequest}
              className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-400 transition-all duration-200 ease-out active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingFriendRequest ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              )}
              Freundschaftsanfrage senden
            </button>
          </div>
        </div>
      ) : (
        <div className="px-6 py-3 border-t border-white/[0.06] shrink-0 bg-surface-elevated">
          <div className="max-w-2xl mx-auto flex gap-2">
            <button
              onClick={() => setShowEventSearch(true)}
              className="p-3 rounded-xl bg-white/[0.06] border border-white/[0.10] hover:border-white/[0.15] transition-colors shrink-0"
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
              className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white/90 placeholder-white/30 focus:outline-none focus:border-white/[0.15] transition-colors"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !messageText.trim()}
              className="p-3 rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
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
