'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SocialNav } from '@/components/Layout/SocialNav';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

interface Group {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_by: string;
  invite_code: string;
  created_at: string;
  member_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

export default function GroupsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    setLoadingGroups(true);

    // Get groups where user is a member
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id);

    if (!memberships || memberships.length === 0) {
      setGroups([]);
      setLoadingGroups(false);
      return;
    }

    const groupIds = memberships.map(m => m.group_id);

    const { data: groupsData } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    if (!groupsData) {
      setGroups([]);
      setLoadingGroups(false);
      return;
    }

    // Get member counts and last messages for each group
    const enriched = await Promise.all(
      groupsData.map(async (g) => {
        const { count } = await supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', g.id);

        const { data: lastMsg } = await supabase
          .from('group_messages')
          .select('content, created_at')
          .eq('group_id', g.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...g,
          member_count: count || 0,
          last_message: lastMsg?.content || null,
          last_message_at: lastMsg?.created_at || null,
        };
      })
    );

    setGroups(enriched);
    setLoadingGroups(false);
  }, [user, supabase]);

  useEffect(() => {
    if (user) fetchGroups();
  }, [user, fetchGroups]);

  const createGroup = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);

    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: group, error } = await supabase
      .from('groups')
      .insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        created_by: user.id,
        invite_code: inviteCode,
      })
      .select()
      .single();

    if (!error && group) {
      // Add creator as owner
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'owner',
      });

      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      await fetchGroups();
      router.push(`/groups/${group.id}`);
    }

    setCreating(false);
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
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
        {/* Header with create button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gruppen</h1>
            <p className="text-white/40 text-sm mt-1">{groups.length} {groups.length === 1 ? 'Gruppe' : 'Gruppen'}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Gruppe
          </button>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
            <div className="w-full max-w-md bg-[#111] border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">Neue Gruppe erstellen</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Gruppenname *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="z.B. Festival Crew 2026"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Beschreibung</label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Worum geht es in dieser Gruppe?"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                  />
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
                  onClick={createGroup}
                  disabled={creating || !newName.trim()}
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

        {/* Groups List */}
        {loadingGroups ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-white/40 text-sm mb-1">Noch keine Gruppen</p>
            <p className="text-white/20 text-xs">Erstelle eine Gruppe und lade deine Freunde ein</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/groups/${g.id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
              >
                {/* Group Image */}
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
                  {g.image_url ? (
                    <img src={g.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{g.name}</h3>
                    <span className="text-xs text-white/20 shrink-0">{g.member_count} Mitglieder</span>
                  </div>
                  {g.last_message ? (
                    <p className="text-xs text-white/30 mt-0.5 truncate">{g.last_message}</p>
                  ) : (
                    <p className="text-xs text-white/20 mt-0.5">Noch keine Nachrichten</p>
                  )}
                </div>

                {/* Time */}
                {g.last_message_at && (
                  <span className="text-[10px] text-white/20 shrink-0">{formatTime(g.last_message_at)}</span>
                )}

                <svg className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
