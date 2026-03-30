'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SocialNav } from '@/components/Layout/SocialNav';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

interface Conversation {
  friendId: string;
  friendName: string;
  friendAvatar: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);

    // Get all DMs involving this user
    const { data: sentMsgs } = await supabase
      .from('direct_messages')
      .select('id, sender_id, receiver_id, content, created_at, read')
      .eq('sender_id', user.id)
      .order('created_at', { ascending: false });

    const { data: receivedMsgs } = await supabase
      .from('direct_messages')
      .select('id, sender_id, receiver_id, content, created_at, read')
      .eq('receiver_id', user.id)
      .order('created_at', { ascending: false });

    const allMsgs = [...(sentMsgs || []), ...(receivedMsgs || [])];

    // Group by conversation partner
    const convMap = new Map<string, { lastMessage: string; lastMessageAt: string; unreadCount: number }>();

    for (const msg of allMsgs) {
      const partnerId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      const existing = convMap.get(partnerId);
      if (!existing || new Date(msg.created_at) > new Date(existing.lastMessageAt)) {
        convMap.set(partnerId, {
          lastMessage: msg.content,
          lastMessageAt: msg.created_at,
          unreadCount: existing?.unreadCount || 0,
        });
      }
      // Count unread
      if (msg.receiver_id === user.id && !msg.read) {
        const curr = convMap.get(partnerId);
        if (curr) curr.unreadCount++;
      }
    }

    // Fetch profiles for all partners
    const partnerIds = Array.from(convMap.keys());
    if (partnerIds.length === 0) {
      setConversations([]);
      setLoadingData(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url')
      .in('id', partnerIds);

    const convs: Conversation[] = partnerIds.map(pid => {
      const info = convMap.get(pid)!;
      const profile = profiles?.find(p => p.id === pid);
      return {
        friendId: pid,
        friendName: profile ? `${profile.first_name} ${profile.last_name}` : 'Unbekannt',
        friendAvatar: profile?.avatar_url || null,
        lastMessage: info.lastMessage,
        lastMessageAt: info.lastMessageAt,
        unreadCount: info.unreadCount,
      };
    });

    // Sort by last message time
    convs.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    setConversations(convs);
    setLoadingData(false);
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user, fetchConversations]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dm-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        () => { fetchConversations(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, supabase, fetchConversations]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'gerade eben';
    if (diff < 3600000) return `vor ${Math.floor(diff / 60000)} Min.`;
    if (diff < 86400000) return `vor ${Math.floor(diff / 3600000)} Std.`;
    return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short' });
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
        <h1 className="text-2xl font-bold mb-6">Nachrichten</h1>

        {loadingData ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm mb-1">Noch keine Nachrichten</p>
            <p className="text-white/20 text-xs">Sende eine Nachricht an einen Freund</p>
            <Link href="/friends" className="inline-block mt-4 text-sm text-white/40 hover:text-white underline">
              Freunde finden
            </Link>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => (
              <Link
                key={c.friendId}
                href={`/messages/${c.friendId}`}
                className="flex items-center gap-3 p-4 rounded-xl hover:bg-white/5 transition-colors group"
              >
                {/* Avatar */}
                {c.friendAvatar ? (
                  <img src={c.friendAvatar} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/60 shrink-0">
                    {c.friendName?.[0]?.toUpperCase() || '?'}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${c.unreadCount > 0 ? 'font-semibold' : 'font-medium'}`}>
                      {c.friendName}
                    </p>
                    <span className="text-[10px] text-white/20 shrink-0 ml-2">{formatTime(c.lastMessageAt)}</span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 ${c.unreadCount > 0 ? 'text-white/60' : 'text-white/30'}`}>
                    {c.lastMessage}
                  </p>
                </div>

                {/* Unread badge */}
                {c.unreadCount > 0 && (
                  <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-black">{c.unreadCount}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
