'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { UserIcon, HeartIcon, UsersIcon, ChatBubbleIcon, GroupIcon, NewspaperIcon, BoltIcon, LogoutIcon } from '../UI/Icons';
import { NotificationBell } from '@/components/Notifications/NotificationBell';

export function ProfileDropdown() {
  const { user, profile, signOut } = useAuth();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [unreadDMs, setUnreadDMs] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch unread DM count
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('read', false);
      setUnreadDMs(count || 0);
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user, supabase]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const itemClass = 'block px-4 py-2.5 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors';

  return (
    <div className="relative shrink-0 flex items-center gap-2" ref={ref}>
      <NotificationBell className="w-9 h-9 rounded-lg hover:bg-white/[0.06]" />
      <button
        onClick={() => setOpen(!open)}
        aria-label="Benutzermenü"
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 hover:bg-white/[0.06]"
      >
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold overflow-hidden bg-white/[0.08] text-white/60">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextElementSibling) {
                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
          ) : null}
          <span style={{ display: profile?.avatar_url ? 'none' : 'flex' }} className="w-full h-full items-center justify-center">
            {profile?.first_name?.[0] || user.email?.[0]?.toUpperCase() || '?'}
          </span>
        </div>
        <svg className={`w-3 h-3 transition-transform duration-200 text-white/40 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-2xl border z-50 overflow-hidden bg-[#1a1a1c] border-white/[0.08]">
          <div className="px-4 py-3 border-b border-white/[0.08]">
            <p className="text-sm font-medium text-white">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-white/40">
              {user.email}
            </p>
          </div>
          <div className="py-1">
            <Link href="/profile" onClick={() => setOpen(false)} className={itemClass}>
              <UserIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Mein Profil
            </Link>
            <Link href="/saved" onClick={() => setOpen(false)} className={itemClass}>
              <HeartIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Gespeicherte Events
            </Link>
            <Link href="/friends" onClick={() => setOpen(false)} className={itemClass}>
              <UsersIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Freunde
            </Link>
            <Link href="/messages" onClick={() => setOpen(false)} className={itemClass}>
              <ChatBubbleIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Nachrichten
              {unreadDMs > 0 && (
                <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadDMs}</span>
              )}
            </Link>
            <Link href="/groups" onClick={() => setOpen(false)} className={itemClass}>
              <GroupIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Meine Gruppen
            </Link>
            <Link href="/feed" onClick={() => setOpen(false)} className={itemClass}>
              <NewspaperIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Feed
            </Link>
            {(profile?.role === 'god' || profile?.role === 'admin') && (
              <Link href="/admin" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-amber-400 hover:bg-white/[0.06] transition-colors">
                <BoltIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Admin Panel
              </Link>
            )}
          </div>
          <div className="py-1 border-t border-white/[0.08]">
            <button
              onClick={() => { signOut(); setOpen(false); }}
              className="block w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <LogoutIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Abmelden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
