'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Search, ChevronRight, Trash2, Bookmark, UsersRound, UserCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
}

const ROLE_STYLES: Record<string, string> = {
  god: 'bg-amber-400/20 text-amber-400',
  admin: 'bg-blue-400/20 text-blue-400',
  business: 'bg-purple-400/20 text-purple-400',
  user: 'bg-white/10 text-white/40',
};

export default function UsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<{
    savedEvents: number;
    groups: number;
    friends: number;
  } | null>(null);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('profiles')
      .select('id, first_name, last_name, email, role, avatar_url, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (userSearch.trim()) {
      query = query.or(
        `first_name.ilike.%${userSearch}%,last_name.ilike.%${userSearch}%,email.ilike.%${userSearch}%`
      );
    }

    const { data } = await query;
    setUsers((data as UserRow[]) || []);
    setLoading(false);
  }, [supabase, userSearch]);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(), 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const toggleExpandUser = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setExpandedData(null);
      return;
    }
    setExpandedUser(userId);
    setExpandedData(null);
    const [{ count: savedEvents }, { count: groups }, { count: friends }] = await Promise.all([
      supabase
        .from('saved_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('friendships')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    ]);
    setExpandedData({
      savedEvents: savedEvents || 0,
      groups: groups || 0,
      friends: friends || 0,
    });
  };

  const changeRole = async (userId: string, newRole: string) => {
    setRoleChanging(userId);
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    setRoleChanging(null);
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Benutzer wirklich loschen? Diese Aktion kann nicht ruckgangig gemacht werden.'))
      return;
    await supabase.from('profiles').delete().eq('id', userId);
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-5 h-5 text-white/40" />
        <h1 className="text-2xl font-semibold text-white/90">Users</h1>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder="Benutzer suchen..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/20"
        />
      </div>

      {/* Users list */}
      {loading ? (
        <div className="text-center text-white/40 py-16">Loading...</div>
      ) : users.length === 0 ? (
        <div className="text-center text-white/40 py-16">No users found.</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
            >
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => toggleExpandUser(u.id)}
              >
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white/60">
                    {u.first_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-white/90">
                    {u.first_name} {u.last_name}
                  </p>
                  <p className="text-xs text-white/30 truncate">{u.email}</p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${ROLE_STYLES[u.role] || ROLE_STYLES.user}`}
                >
                  {u.role}
                </span>
                <span className="text-xs text-white/20">{formatDate(u.created_at)}</span>
                <ChevronRight
                  className={`w-4 h-4 text-white/20 transition-transform ${expandedUser === u.id ? 'rotate-90' : ''}`}
                />
              </div>

              {expandedUser === u.id && (
                <div className="px-3 pb-3 pt-1 border-t border-white/[0.04]">
                  {expandedData ? (
                    <div className="flex gap-4 mb-3">
                      <span className="flex items-center gap-1 text-xs text-white/30">
                        <Bookmark className="w-3 h-3" />
                        {expandedData.savedEvents} saved events
                      </span>
                      <span className="flex items-center gap-1 text-xs text-white/30">
                        <UsersRound className="w-3 h-3" />
                        {expandedData.groups} groups
                      </span>
                      <span className="flex items-center gap-1 text-xs text-white/30">
                        <UserCheck className="w-3 h-3" />
                        {expandedData.friends} friends
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs text-white/20 mb-3">Loading details...</div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-white/40">Role:</label>
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      disabled={roleChanging === u.id}
                      className="text-xs px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white focus:outline-none disabled:opacity-50"
                    >
                      <option value="user">user</option>
                      <option value="business">business</option>
                      <option value="admin">admin</option>
                      <option value="god">god</option>
                    </select>
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1 rounded-lg text-red-400/60 hover:bg-red-400/10 hover:text-red-400 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
