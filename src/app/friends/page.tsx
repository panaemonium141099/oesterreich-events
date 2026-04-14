'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { ProfileDropdown } from '@/components/Layout/ProfileDropdown';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';

interface ProfileResult {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  email: string;
}

interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  requester: ProfileResult;
  addressee: ProfileResult;
}

type Tab = 'friends' | 'incoming' | 'outgoing';

export default function FriendsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('friends');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [incoming, setIncoming] = useState<Friendship[]>([]);
  const [outgoing, setOutgoing] = useState<Friendship[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { trackEvent('page_view', { path: '/friends' }); }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchFriendships = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);

    try {
      const { data: accepted } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at, requester:profiles!friendships_requester_id_fkey(id, first_name, last_name, avatar_url, email), addressee:profiles!friendships_addressee_id_fkey(id, first_name, last_name, avatar_url, email)')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

      const { data: pendingIn } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at, requester:profiles!friendships_requester_id_fkey(id, first_name, last_name, avatar_url, email), addressee:profiles!friendships_addressee_id_fkey(id, first_name, last_name, avatar_url, email)')
        .eq('status', 'pending')
        .eq('addressee_id', user.id);

      const { data: pendingOut } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id, status, created_at, requester:profiles!friendships_requester_id_fkey(id, first_name, last_name, avatar_url, email), addressee:profiles!friendships_addressee_id_fkey(id, first_name, last_name, avatar_url, email)')
        .eq('status', 'pending')
        .eq('requester_id', user.id);

      setFriends((accepted as any) || []);
      setIncoming((pendingIn as any) || []);
      setOutgoing((pendingOut as any) || []);
    } catch {
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoadingData(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchFriendships();
  }, [user, fetchFriendships]);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim() || !user) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, email')
      .neq('id', user.id)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    setSearchResults((data as ProfileResult[]) || []);
    setSearching(false);
  }, [user, supabase]);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(search), 300);
    return () => clearTimeout(timer);
  }, [search, searchUsers]);

  const getFriend = (f: Friendship): ProfileResult => {
    const r = f.requester as any;
    const a = f.addressee as any;
    // Supabase join returns single objects (not arrays) for !inner joins
    const requester = Array.isArray(r) ? r[0] : r;
    const addressee = Array.isArray(a) ? a[0] : a;
    return requester?.id === user?.id ? addressee : requester;
  };

  const sendRequest = async (targetId: string) => {
    setActionLoading(targetId);
    try {
      const { error } = await supabase.from('friendships').insert({
        requester_id: user!.id,
        addressee_id: targetId,
        status: 'pending',
      });
      if (error) throw error;
      await fetchFriendships();
      setSearch('');
      setSearchResults([]);
      toast.success('Freundschaftsanfrage gesendet');
    } catch {
      toast.error('Fehler beim Senden der Anfrage');
    } finally {
      setActionLoading(null);
    }
  };

  const acceptRequest = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    try {
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
      if (error) throw error;
      await fetchFriendships();
      toast.success('Freundschaftsanfrage angenommen');
    } catch {
      toast.error('Fehler bei der Anfrage');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectRequest = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
      await fetchFriendships();
      toast.success('Anfrage abgelehnt');
    } catch {
      toast.error('Fehler bei der Anfrage');
    } finally {
      setActionLoading(null);
    }
  };

  const removeFriend = async (friendshipId: string) => {
    setActionLoading(friendshipId);
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
      await fetchFriendships();
      toast.success('Freund entfernt');
    } catch {
      toast.error('Fehler beim Entfernen');
    } finally {
      setActionLoading(null);
    }
  };

  const isAlreadyFriendOrPending = (userId: string): boolean => {
    return [...friends, ...incoming, ...outgoing].some(
      f => f.requester_id === userId || f.addressee_id === userId
    );
  };

  const Avatar = ({ profile, size = 'md' }: { profile: ProfileResult; size?: 'sm' | 'md' }) => {
    const s = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
    return profile.avatar_url ? (
      <img src={profile.avatar_url} alt="" className={`${s} rounded-full object-cover`} />
    ) : (
      <div className={`${s} rounded-full bg-white/10 flex items-center justify-center font-semibold text-white/60`}>
        {profile.first_name?.[0]?.toUpperCase() || '?'}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface text-white">
<main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between mb-6 animate-pulse motion-reduce:animate-none">
            <div className="h-7 w-28 rounded bg-white/[0.06]" />
            <div className="w-8 h-8 rounded-full bg-white/[0.06]" />
          </div>
          <div className="h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-6 animate-pulse motion-reduce:animate-none" />
          <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-pulse motion-reduce:animate-none">
            {[1, 2, 3].map(i => <div key={i} className="flex-1 h-9 rounded-lg bg-white/[0.06]" />)}
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse motion-reduce:animate-none" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-10 h-10 rounded-full bg-white/[0.06] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/[0.06] rounded w-1/3" />
                  <div className="h-3 bg-white/[0.04] rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 text-white">
        <p className="text-white/60">Bitte melde dich an um Freunde zu sehen.</p>
        <a href="/auth/login" className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-colors">Anmelden</a>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'friends', label: 'Freunde', count: friends.length },
    { key: 'incoming', label: 'Anfragen', count: incoming.length },
    { key: 'outgoing', label: 'Gesendet', count: outgoing.length },
  ];

  return (
    <div
      className="min-h-screen text-white pb-24 bg-surface"
    >
<main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Freunde</h1>
          <ProfileDropdown />
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Freunde suchen (Name oder E-Mail)..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
          />
          {searching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search Results */}
        {search.trim() && searchResults.length > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Suchergebnisse</p>
            {searchResults.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <Link href={`/profile/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <Avatar profile={p} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.first_name} {p.last_name}</p>
                    <p className="text-xs text-white/30 truncate">{p.email}</p>
                  </div>
                </Link>
                {isAlreadyFriendOrPending(p.id) ? (
                  <span className="text-xs text-white/30 px-3 py-1.5">Bereits verbunden</span>
                ) : (
                  <button
                    onClick={() => sendRequest(p.id)}
                    disabled={actionLoading === p.id}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === p.id ? '...' : 'Freund hinzuf\u00fcgen'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {search.trim() && searchResults.length === 0 && !searching && (
          <div className="mb-6 text-center py-6">
            <p className="text-white/30 text-sm">Keine Benutzer gefunden</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 border border-white/10">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white text-black'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`ml-1.5 text-xs ${tab === t.key ? 'text-black/50' : 'text-white/20'}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loadingData ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-pulse motion-reduce:animate-none">
                <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/10 rounded w-1/3" />
                  <div className="h-3 bg-white/10 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Friends Tab */}
            {tab === 'friends' && (
              friends.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-white/40 text-sm mb-1">Noch keine Freunde</p>
                  <p className="text-white/20 text-xs">Suche nach Personen, um sie als Freunde hinzuzuf&uuml;gen</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((f) => {
                    const friend = getFriend(f);
                    return (
                      <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                        <Link href={`/profile/${friend.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                          <Avatar profile={friend} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{friend.first_name} {friend.last_name}</p>
                            <p className="text-xs text-white/30 truncate">{friend.email}</p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/messages/${friend.id}`}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                          >
                            Nachricht
                          </Link>
                          <button
                            onClick={() => removeFriend(f.id)}
                            disabled={actionLoading === f.id}
                            className="text-xs px-3 py-1.5 rounded-lg text-red-400/60 hover:bg-red-400/10 hover:text-red-400 transition-colors disabled:opacity-50"
                          >
                            Entfernen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Incoming Tab */}
            {tab === 'incoming' && (
              incoming.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <p className="text-white/40 text-sm">Keine offenen Anfragen</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {incoming.map((f) => {
                    const requester = Array.isArray(f.requester) ? f.requester[0] : f.requester;
                    return (
                      <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                        <Link href={`/profile/${requester.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                          <Avatar profile={requester} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{requester.first_name} {requester.last_name}</p>
                            <p className="text-xs text-white/30 truncate">{requester.email}</p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => acceptRequest(f.id)}
                            disabled={actionLoading === f.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                          >
                            Annehmen
                          </button>
                          <button
                            onClick={() => rejectRequest(f.id)}
                            disabled={actionLoading === f.id}
                            className="text-xs px-3 py-1.5 rounded-lg text-red-400/60 hover:bg-red-400/10 hover:text-red-400 transition-colors disabled:opacity-50"
                          >
                            Ablehnen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Outgoing Tab */}
            {tab === 'outgoing' && (
              outgoing.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <p className="text-white/40 text-sm">Keine gesendeten Anfragen</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {outgoing.map((f) => {
                    const addressee = Array.isArray(f.addressee) ? f.addressee[0] : f.addressee;
                    return (
                      <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                        <Link href={`/profile/${addressee.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                          <Avatar profile={addressee} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{addressee.first_name} {addressee.last_name}</p>
                            <p className="text-xs text-white/30 truncate">{addressee.email}</p>
                          </div>
                        </Link>
                        <button
                          onClick={() => rejectRequest(f.id)}
                          disabled={actionLoading === f.id}
                          className="text-xs px-3 py-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white/60 transition-colors disabled:opacity-50"
                        >
                          Zur&uuml;ckziehen
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}
