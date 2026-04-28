'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { FilterBar } from '../Filters/FilterBar';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { UserIcon, HeartIcon, UsersIcon, ChatBubbleIcon, GroupIcon, NewspaperIcon, BoltIcon, LogoutIcon } from '../UI/Icons';
import type { EventFilters } from '@/types/events';
import type { Bundesland } from '@/lib/bundeslaender';
import { BUNDESLAENDER } from '@/lib/bundeslaender';
import { trackEvent } from '@/lib/analytics';
import { NotificationBell } from '@/components/Notifications/NotificationBell';

interface HeaderProps {
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  totalEvents: number;
  onToggleSidebar: () => void;
  eveningMode: boolean;
  onToggleEveningMode: () => void;
  bundesland: Bundesland;
  onBundeslandChange: (bl: Bundesland) => void;
  onGemeindeSelect?: (gemeinde: { name: string; bundeslandId: string; lat: number; lng: number }) => void;
}

export function Header({ filters, onFiltersChange, totalEvents, onToggleSidebar, eveningMode, onToggleEveningMode, bundesland, onBundeslandChange, onGemeindeSelect }: HeaderProps) {
  const [blDropdownOpen, setBlDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // removed night emoji
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const supabase = createClient();
  const prevTotalRef = useRef(totalEvents);
  const [countBounce, setCountBounce] = useState(false);
  const [unreadDMs, setUnreadDMs] = useState(0);

  useEffect(() => {
    if (prevTotalRef.current !== totalEvents) {
      prevTotalRef.current = totalEvents;
      setCountBounce(true);
      const timer = setTimeout(() => setCountBounce(false), 350);
      return () => clearTimeout(timer);
    }
  }, [totalEvents]);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setBlDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <header className={`z-50 transition-colors duration-500 ${
      eveningMode
        ? 'bg-slate-900/70 backdrop-blur-xl border-b border-slate-700/30 shadow-lg shadow-black/20'
        : 'bg-white/70 backdrop-blur-xl border-b border-slate-200/50 shadow-sm'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggleSidebar}
          className={`p-2 rounded-lg transition-colors lg:hidden ${
            eveningMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-slate-100'
          }`}
          title="Sidebar ein-/ausblenden"
          aria-label="Sidebar ein-/ausblenden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Home / Logo */}
        <button
          onClick={(e) => {
            e.preventDefault();
            // Create black curtain overlay that drops from top
            const curtain = document.createElement('div');
            curtain.style.cssText = `
              position: fixed; inset: 0; z-index: 9999;
              background: #000;
              transform: translateY(-100%);
              transition: transform 0.7s cubic-bezier(0.76, 0, 0.24, 1);
            `;
            document.body.appendChild(curtain);
            // Trigger animation
            requestAnimationFrame(() => {
              curtain.style.transform = 'translateY(0)';
            });
            setTimeout(() => window.location.href = '/?home', 500);
          }}
          className={`flex items-center gap-1.5 px-1.5 py-1 lg:px-2 lg:py-1.5 rounded-lg transition-all duration-200 group shrink-0 ${
            eveningMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-50'
          }`}
          title="Zurück zur Startseite"
          aria-label="Zurück zur Startseite"
        >
          <div className={`text-[10px] uppercase tracking-[0.12em] leading-tight font-medium ${
            eveningMode ? 'text-amber-400/60 group-hover:text-amber-400' : 'text-slate-400 group-hover:text-slate-600'
          } transition-colors`}>
            ÖE
          </div>
        </button>

        <div className={`w-px h-6 ${eveningMode ? 'bg-gray-700' : 'bg-slate-200'}`} />

        <div className="flex items-center gap-3 relative" ref={dropdownRef}>
          <button
            onClick={() => setBlDropdownOpen(!blDropdownOpen)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all duration-300 ${
              eveningMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-50'
            }`}
          >
            <div className={`w-1 h-10 rounded-full ${eveningMode ? 'bg-amber-400' : 'bg-slate-800'}`} />
            <div className="text-left">
              <p className={`text-[10px] uppercase tracking-[0.15em] leading-tight ${eveningMode ? 'text-amber-400/70' : 'text-slate-400'}`}>
                Lass treffen in...
              </p>
              <h1 className={`text-lg font-bold leading-tight ${eveningMode ? 'text-gray-100' : 'text-slate-800'}`}>
                {bundesland.name === 'Ganz Österreich' ? 'Österreich' : bundesland.name}
              </h1>
              <p className={`text-[10px] ${eveningMode ? 'text-gray-500' : 'text-slate-400'}`}>
                <span className={countBounce ? 'animate-count-bounce inline-block' : 'inline-block'}>{totalEvents.toLocaleString('de-AT')}</span> Veranstaltungen
              </p>
            </div>
            <svg className={`w-4 h-4 transition-transform ${blDropdownOpen ? 'rotate-180' : ''} ${eveningMode ? 'text-gray-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {blDropdownOpen && (
            <div className={`absolute top-full left-0 mt-1 w-56 rounded-xl shadow-xl border z-[100] py-1 animate-fade-in-up ${
              eveningMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'
            }`}>
              {BUNDESLAENDER.map(bl => (
                <button
                  key={bl.id}
                  onClick={() => { trackEvent('bundesland_switch', { from: bundesland.name, to: bl.name }); onBundeslandChange(bl); setBlDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${
                    bl.id === bundesland.id
                      ? eveningMode ? 'bg-amber-400/10 text-amber-300' : 'bg-slate-50 text-slate-900'
                      : eveningMode ? 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {bl.id === bundesland.id && (
                    <div className={`w-0.5 h-4 rounded-full ${eveningMode ? 'bg-amber-400' : 'bg-slate-800'}`} />
                  )}
                  <span className={bl.id === bundesland.id ? 'font-medium' : ''}>{bl.name}</span>
                  {bl.id === bundesland.id && (
                    <svg className={`w-3.5 h-3.5 ml-auto ${eveningMode ? 'text-amber-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop search slot — inline between bundesland-selector and
            evening-mode toggle. On mobile this slot is hidden because the
            hamburger + ÖE-logo + bundesland-selector + evening-toggle
            fill the entire 390px viewport row, leaving 0px for a flex-1
            input. The search bar is rendered in a dedicated 2nd row
            below for mobile (see the `lg:hidden` block after this
            container). */}
        <div className="hidden lg:block flex-1 min-w-0 overflow-hidden">
          <FilterBar filters={filters} onFiltersChange={onFiltersChange} eveningMode={eveningMode} bundeslandId={bundesland.id} onGemeindeSelect={onGemeindeSelect} />
        </div>

        {/* Evening Mode Toggle */}
        <button
          onClick={() => { trackEvent('nachtleben_toggle', { enabled: !eveningMode }); onToggleEveningMode(); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-300 shrink-0 cursor-pointer ${
            eveningMode
              ? 'text-amber-400'
              : 'text-slate-400 hover:text-slate-600'
          }`}
          title={eveningMode ? 'Nachtleben aktiv' : 'Nachtleben anzeigen'}
          aria-label={eveningMode ? 'Nachtleben aktiv' : 'Nachtleben anzeigen'}
        >
          <svg className="w-4 h-4 transition-transform duration-500" fill={eveningMode ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" style={{ transform: eveningMode ? 'rotate(360deg)' : 'rotate(0deg)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
          <span className="hidden sm:inline text-xs font-medium tracking-wide">Nachtleben</span>
          <div className={`w-8 h-[18px] rounded-full relative transition-all duration-300 ${
            eveningMode ? 'bg-amber-400' : 'bg-slate-200'
          }`}>
            <div className={`w-3.5 h-3.5 rounded-full absolute top-[2px] transition-all duration-300 shadow-sm ${
              eveningMode ? 'translate-x-[14px] bg-slate-900' : 'translate-x-[2px] bg-white'
            }`} />
          </div>
        </button>

        {/* Social Hub — prominent button to access social features */}
        {user && (
          <>
            <div className={`w-px h-6 shrink-0 ${eveningMode ? 'bg-gray-700' : 'bg-slate-200'}`} />
            <NotificationBell className={`w-9 h-9 rounded-lg ${
              eveningMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-100'
            }`} />
            <Link
              href="/feed"
              aria-label="Social Hub"
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0 min-h-[44px] active:scale-[0.97] motion-reduce:transform-none ${
                eveningMode
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Social</span>
              {unreadDMs > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unreadDMs > 9 ? '9+' : unreadDMs}
                </span>
              )}
            </Link>
          </>
        )}

        {/* User Auth */}
        {!authLoading && (
          <div className="relative shrink-0" ref={userMenuRef}>
            {user ? (
              <>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-label="Benutzermenü"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all duration-200 ${
                    eveningMode ? 'hover:bg-gray-700/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold overflow-hidden ${
                    eveningMode ? 'bg-amber-400/20 text-amber-400' : 'bg-blue-100 text-blue-600'
                  }`}>
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
                  <svg className={`w-3 h-3 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''} ${eveningMode ? 'text-gray-400' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl shadow-xl border z-50 overflow-hidden ${
                    eveningMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-slate-200'
                  }`}>
                    <div className={`px-4 py-3 border-b ${eveningMode ? 'border-gray-700' : 'border-slate-100'}`}>
                      <p className={`text-sm font-medium ${eveningMode ? 'text-white' : 'text-slate-900'}`}>
                        {profile?.first_name} {profile?.last_name}
                      </p>
                      <p className={`text-xs ${eveningMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        {user.email}
                      </p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          eveningMode ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <UserIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Mein Profil
                      </Link>
                      <Link
                        href="/saved"
                        onClick={() => setUserMenuOpen(false)}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          eveningMode ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <HeartIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Gespeicherte Events
                      </Link>
                      <Link
                        href="/friends"
                        onClick={() => setUserMenuOpen(false)}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          eveningMode ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <UsersIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Freunde
                      </Link>
                      <Link
                        href="/messages"
                        onClick={() => setUserMenuOpen(false)}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          eveningMode ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <ChatBubbleIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Nachrichten
                        {unreadDMs > 0 && (
                          <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadDMs}</span>
                        )}
                      </Link>
                      <Link
                        href="/groups"
                        onClick={() => setUserMenuOpen(false)}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          eveningMode ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <GroupIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Meine Gruppen
                      </Link>
                      <Link
                        href="/feed"
                        onClick={() => setUserMenuOpen(false)}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          eveningMode ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <NewspaperIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Feed
                      </Link>
                      {(profile?.role === 'god' || profile?.role === 'admin') && (
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className={`block px-4 py-2.5 text-sm transition-colors ${
                            eveningMode ? 'text-amber-400 hover:bg-gray-700' : 'text-blue-600 hover:bg-slate-50'
                          }`}
                        >
                          <BoltIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Admin Panel
                        </Link>
                      )}
                    </div>
                    <div className={`py-1 border-t ${eveningMode ? 'border-gray-700' : 'border-slate-100'}`}>
                      <button
                        onClick={() => { signOut(); setUserMenuOpen(false); }}
                        className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          eveningMode ? 'text-red-400 hover:bg-gray-700' : 'text-red-500 hover:bg-red-50'
                        }`}
                      >
                        <LogoutIcon size={16} className="inline-block mr-1.5 -mt-0.5" /> Abmelden
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Link
                href="/auth/login"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  eveningMode
                    ? 'text-amber-400/80 hover:text-amber-400 hover:bg-gray-700/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="hidden sm:inline">Anmelden</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Mobile-only search row — the desktop FilterBar slot is hidden
          (lg:block) on viewports < 1024px because the top row's fixed-
          width children (hamburger + ÖE + divider + bundesland-selector
          + evening-toggle + auth) consume the entire 390-414px mobile
          viewport, squashing flex-1 to 0. Putting the search bar in
          its own row below the title row gives it the full available
          width on mobile and keeps the existing desktop layout
          unchanged. */}
      <div className="lg:hidden px-4 pb-3">
        <FilterBar filters={filters} onFiltersChange={onFiltersChange} eveningMode={eveningMode} bundeslandId={bundesland.id} onGemeindeSelect={onGemeindeSelect} />
      </div>
    </header>
  );
}
