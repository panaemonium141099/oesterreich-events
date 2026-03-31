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

interface FriendOption {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);

    try {
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
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', partnerIds);

      const convs: Conversation[] = partnerIds.map(pid => {
        const info = convMap.get(pid)!;
        const profile = profiles?.find((p: { id: string; first_name: string; last_name: string; avatar_url: string | null }) => p.id === pid);
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
    } catch {
      setConversations([]);
    } finally {
      setLoadingData(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user, fetchConversations]);

  // Load friends for new message modal
  const loadFriends = useCallback(async () => {
    if (!user) return;
    setLoadingFriends(true);
    try {
      const { data: accepted } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, requester:profiles!friendships_requester_id_fkey(id, first_name, last_name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, first_name, last_name, avatar_url)')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      if (accepted) {
        const list: FriendOption[] = accepted.map((f: any) => {
          const req = Array.isArray(f.requester) ? f.requester[0] : f.requester;
          const addr = Array.isArray(f.addressee) ? f.addressee[0] : f.addressee;
          return req?.id === user.id ? addr : req;
        }).filter(Boolean);
        setFriends(list);
      }
    } catch { /* ignore */ }
    setLoadingFriends(false);
  }, [user, supabase]);

  useEffect(() => {
    if (showNewMessage) loadFriends();
  }, [showNewMessage, loadFriends]);

  const filteredFriends = friends.filter(f => {
    if (!friendSearch.trim()) return true;
    const q = friendSearch.toLowerCase();
    return f.first_name?.toLowerCase().includes(q) || f.last_name?.toLowerCase().includes(q);
  });

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

  // Rule 5: Skeleton loading instead of spinner for auth loading
  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <SocialNav />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="h-7 w-40 bg-white/10 rounded animate-pulse motion-reduce:animate-none" />
            <div className="h-[44px] w-36 bg-white/10 rounded-xl animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse motion-reduce:animate-none"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="w-11 h-11 rounded-full bg-white/10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-1/3" />
                  <div className="h-3 bg-white/10 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </main>
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
          <h1 className="text-2xl font-bold">Nachrichten</h1>
          {/* Rule 2: min-h-[44px], Rule 3: active:scale-[0.97], Rule 12: focus-visible ring */}
          <button
            onClick={() => setShowNewMessage(true)}
            className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all duration-200 ease-out active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Neue Nachricht
          </button>
        </div>

        {/* New Message Modal */}
        {showNewMessage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-[fadeIn_200ms_ease-out] motion-reduce:animate-none"
            onClick={() => { setShowNewMessage(false); setFriendSearch(''); }}
          >
            <div
              className="w-full max-w-md bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 max-h-[80vh] flex flex-col animate-[scaleIn_200ms_ease-out] motion-reduce:animate-none"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold mb-4">Neue Nachricht</h2>

              {/* Friend search - Rule 12: focus-visible ring */}
              <div className="relative mb-4">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Freund suchen..."
                  className="w-full pl-10 pr-4 py-3 min-h-[44px] rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-white/20"
                  autoFocus
                />
              </div>

              {/* Friends list */}
              <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                {loadingFriends ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse motion-reduce:animate-none"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
                        <div className="h-4 bg-white/10 rounded w-1/3" />
                      </div>
                    ))}
                  </div>
                ) : filteredFriends.length === 0 ? (
                  /* Rule 13: Empty state with icon + text + action */
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-white/30 text-sm leading-relaxed">
                      {friends.length === 0 ? 'Noch keine Freunde' : 'Kein Freund gefunden'}
                    </p>
                    {friends.length === 0 && (
                      <Link
                        href="/friends"
                        className="inline-flex items-center gap-1.5 mt-3 px-4 min-h-[44px] text-sm text-white/50 hover:text-white/80 transition-colors duration-200 ease-out focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Freunde hinzuf&uuml;gen
                      </Link>
                    )}
                  </div>
                ) : (
                  filteredFriends.map((f, index) => (
                    <button
                      key={f.id}
                      onClick={() => { setShowNewMessage(false); setFriendSearch(''); router.push(`/messages/${f.id}`); }}
                      className="w-full flex items-center gap-3 p-3 min-h-[44px] rounded-xl hover:bg-white/5 transition-colors duration-200 ease-out text-left active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none animate-[fadeIn_200ms_ease-out_both] motion-reduce:animate-none"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {f.avatar_url ? (
                        <img src={f.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white/60 shrink-0">
                          {f.first_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{f.first_name} {f.last_name}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Rule 2: min-h touch target, Rule 12: focus ring */}
              <button
                onClick={() => { setShowNewMessage(false); setFriendSearch(''); }}
                className="w-full mt-4 min-h-[44px] py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors duration-200 ease-out rounded-xl active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {loadingData ? (
          /* Rule 7: glassmorphism on skeleton cards, Rule 8: stagger */
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse motion-reduce:animate-none"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <div className="w-11 h-11 rounded-full bg-white/10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-1/3" />
                  <div className="h-3 bg-white/10 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          /* Rule 13: empty state already good, add focus ring + touch target to link */
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm mb-1 leading-relaxed">Noch keine Nachrichten</p>
            <p className="text-white/20 text-xs leading-relaxed">Sende eine Nachricht an einen Freund</p>
            <Link
              href="/friends"
              className="inline-flex items-center gap-2 mt-4 px-5 min-h-[44px] py-2.5 text-sm font-medium text-white/60 hover:text-white bg-white/[0.03] border border-white/[0.06] rounded-xl transition-all duration-200 ease-out active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Freunde finden
            </Link>
          </div>
        ) : (
          /* Rule 7: glassmorphism on items, Rule 8: stagger entrance */
          <div className="space-y-2">
            {conversations.map((c, index) => (
              <Link
                key={c.friendId}
                href={`/messages/${c.friendId}`}
                className="flex items-center gap-3 p-4 min-h-[44px] rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all duration-200 ease-out group active:scale-[0.97] motion-reduce:transform-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none animate-[fadeIn_200ms_ease-out_both] motion-reduce:animate-none"
                style={{ animationDelay: `${index * 35}ms` }}
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
                    <span className="text-xs text-white/20 shrink-0 ml-2">{formatTime(c.lastMessageAt)}</span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 leading-relaxed ${c.unreadCount > 0 ? 'text-white/60' : 'text-white/30'}`}>
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
