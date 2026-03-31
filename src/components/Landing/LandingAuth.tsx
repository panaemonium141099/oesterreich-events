'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { UserIcon, HeartIcon, UsersIcon, ChatBubbleIcon, NewspaperIcon, CalendarIcon, BoltIcon, LogoutIcon } from '../UI/Icons';

export function LandingAuth() {
  const { user, profile, loading, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Show buttons after 1s even if auth is still loading
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setForceShow(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (loading && !forceShow) return null;

  return (
    <div
      className="fixed top-6 right-6 z-50 animate-fade-in"
      style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}
      ref={menuRef}
    >
      {user ? (
        <div className="flex items-center gap-2.5">
          {/* Social Hub Button */}
          <Link
            href="/feed"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all duration-200 active:scale-[0.97] motion-reduce:transform-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Social
          </Link>

          {/* Profile Menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-sm text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-semibold">
                  {profile?.first_name?.[0] || user.email?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <svg className={`w-3 h-3 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl shadow-2xl border border-white/10 bg-black/90 backdrop-blur-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="text-sm font-medium text-white">
                    {profile?.first_name} {profile?.last_name}
                  </p>
                  <p className="text-xs text-white/40">{user.email}</p>
                </div>
                <div className="py-1">
                  <Link href="/profile" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                    <UserIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Mein Profil
                  </Link>
                  <Link href="/saved" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                    <HeartIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Gespeicherte Events
                  </Link>
                  <Link href="/friends" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                    <UsersIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Freunde
                  </Link>
                  <Link href="/messages" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                    <ChatBubbleIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Nachrichten
                  </Link>
                  <Link href="/feed" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                    <NewspaperIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Feed
                  </Link>
                  <Link href="/events/create" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors">
                    <CalendarIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Event erstellen
                  </Link>
                  {(profile?.role === 'god' || profile?.role === 'admin') && (
                    <Link href="/admin" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-amber-400/80 hover:text-amber-400 hover:bg-white/5 transition-colors">
                      <BoltIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Admin Panel
                    </Link>
                  )}
                </div>
                <div className="py-1 border-t border-white/10">
                  <button
                    onClick={() => { signOut(); setMenuOpen(false); }}
                    className="block w-full text-left px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-white/5 transition-colors"
                  >
                    <LogoutIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Abmelden
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="px-4 py-2 rounded-full text-sm text-white/60 hover:text-white transition-colors duration-300"
          >
            Anmelden
          </Link>
          <Link
            href="/auth/register"
            className="px-4 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm text-sm text-white/80 hover:text-white hover:bg-white/10 transition-all duration-300"
          >
            Registrieren
          </Link>
        </div>
      )}
    </div>
  );
}
