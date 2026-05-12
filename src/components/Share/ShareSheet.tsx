'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';

// fn-15.5: AnimatePresence + spring slide-in replaced with CSS
// `data-sheet-state` + `data-overlay-state` swap (see globals.css).
// Keeps the DOM mounted for the exit keyframe duration before unmount.
const EXIT_DURATION_MS = 280;

export interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: {
    type: 'event' | 'post' | 'profile';
    id: string;
    title: string;
    url: string; // relative URL like /events/123
  };
}

interface FriendProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export function ShareSheet({ isOpen, onClose, shareData }: ShareSheetProps) {
  const { user } = useAuth();
  const supabase = createClient();

  const [copied, setCopied] = useState(false);
  const [showFriendPicker, setShowFriendPicker] = useState(false);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Keeps the sheet mounted long enough to run the slide-out CSS animation
  // before unmount. Mirrors the old AnimatePresence behavior.
  const [mounted, setMounted] = useState(isOpen);
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const t = window.setTimeout(() => setMounted(false), EXIT_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [isOpen, mounted]);

  const fullUrl = typeof window !== 'undefined'
    ? window.location.origin + shareData.url
    : shareData.url;

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setShowFriendPicker(false);
      setFriendSearch('');
      setSentTo(null);
    }
  }, [isOpen]);

  // Load friends when friend picker opens
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
        const list: FriendProfile[] = accepted.map((f: Record<string, unknown>) => {
          if (f.requester_id === user.id) {
            const a = f.addressee as FriendProfile;
            return { id: a.id, first_name: a.first_name, last_name: a.last_name, avatar_url: a.avatar_url };
          }
          const r = f.requester as FriendProfile;
          return { id: r.id, first_name: r.first_name, last_name: r.last_name, avatar_url: r.avatar_url };
        });
        setFriends(list);
      }
    } finally {
      setLoadingFriends(false);
    }
  }, [user, supabase]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleWhatsApp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareData.title + ' ' + fullUrl)}`,
      '_blank'
    );
  };

  const handleFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`,
      '_blank'
    );
  };

  const handleEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(shareData.title)}&body=${encodeURIComponent(fullUrl)}`;
  };

  const handleOpenFriendPicker = () => {
    setShowFriendPicker(true);
    loadFriends();
  };

  const handleSendToFriend = async (friend: FriendProfile) => {
    if (!user) return;

    if (shareData.type === 'event') {
      await supabase.from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: friend.id,
        content: `Schau dir das an: ${shareData.title}`,
        message_type: 'event_share',
        event_id: shareData.id,
        read: false,
      });
    } else {
      // posts and profiles: send as text with URL
      await supabase.from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: friend.id,
        content: `${shareData.title} ${fullUrl}`,
        message_type: 'text',
        read: false,
      });
    }

    setSentTo(friend.id);
    setTimeout(() => setSentTo(null), 2000);
  };

  const filteredFriends = friends.filter((f) => {
    if (!friendSearch) return true;
    const name = `${f.first_name || ''} ${f.last_name || ''}`.toLowerCase();
    return name.includes(friendSearch.toLowerCase());
  });

  if (!mounted) return null;

  const state = isOpen ? 'open' : 'closed';

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        data-overlay-state={state}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 rounded-t-2xl px-4 pb-8 pt-4"
        data-sheet-state={state}
      >
            {/* Drag handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Title */}
            <h3 className="text-slate-700 font-medium text-base mb-5">
              {showFriendPicker ? 'An Freund senden' : 'Teilen'}
            </h3>

            {!showFriendPicker ? (
              /* Share options grid */
              <div className="flex flex-wrap gap-2">
                {/* Copy link */}
                <button
                  onClick={handleCopyLink}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 transition-colors min-w-[80px]"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100">
                    {copied ? (
                      <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {copied ? 'Kopiert!' : 'Link kopieren'}
                  </span>
                </button>

                {/* WhatsApp */}
                <button
                  onClick={handleWhatsApp}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 transition-colors min-w-[80px]"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#25D366]/20">
                    <svg className="w-5 h-5 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </div>
                  <span className="text-[11px] text-slate-500">WhatsApp</span>
                </button>

                {/* Facebook */}
                <button
                  onClick={handleFacebook}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 transition-colors min-w-[80px]"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#1877F2]/20">
                    <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </div>
                  <span className="text-[11px] text-slate-500">Facebook</span>
                </button>

                {/* Email */}
                <button
                  onClick={handleEmail}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 transition-colors min-w-[80px]"
                >
                  <div className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-[11px] text-slate-500">Email</span>
                </button>

                {/* Send to friend */}
                {user && (
                  <button
                    onClick={handleOpenFriendPicker}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 transition-colors min-w-[80px]"
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-violet-500/20">
                      <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <span className="text-[11px] text-slate-500">An Freund</span>
                  </button>
                )}
              </div>
            ) : (
              /* Friend picker */
              <div className="space-y-3">
                {/* Back button + search */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFriendPicker(false)}
                    className="p-2 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <input
                    type="text"
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    placeholder="Freund suchen..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-slate-400 transition-colors"
                    autoFocus
                  />
                </div>

                {/* Friends list */}
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {loadingFriends ? (
                    <div className="text-center py-6 text-slate-400 text-sm">Laden...</div>
                  ) : filteredFriends.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-sm">
                      {friends.length === 0 ? 'Noch keine Freunde' : 'Kein Ergebnis'}
                    </div>
                  ) : (
                    filteredFriends.map((friend) => (
                      <button
                        key={friend.id}
                        onClick={() => handleSendToFriend(friend)}
                        disabled={sentTo === friend.id}
                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                      >
                        {friend.avatar_url ? (
                          <img
                            src={friend.avatar_url}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-xs font-semibold text-slate-500">
                            {friend.first_name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <span className="flex-1 text-left text-sm text-slate-600">
                          {friend.first_name} {friend.last_name}
                        </span>
                        {sentTo === friend.id ? (
                          <span className="text-xs text-emerald-400">Gesendet!</span>
                        ) : (
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
      </div>
    </>
  );
}
