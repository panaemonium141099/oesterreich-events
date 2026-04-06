'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PostMenuProps {
  activityId: string;
  isOwner: boolean;
  onShare: () => void;
  onDeleted?: () => void;
}

export function PostMenu({ activityId, isOwner, onShare, onDeleted }: PostMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + '/feed/' + activityId);
    setOpen(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await supabase.from('activities').delete().eq('id', activityId);
    setDeleting(false);
    setOpen(false);
    onDeleted?.();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => { setOpen(!open); setConfirmDelete(false); }}
        className="p-1.5 -mr-1.5 text-white/40 hover:text-white/60 transition-colors"
        aria-label="Mehr Optionen"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-[#1c1c1e] border border-white/[0.10] rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
          <button
            onClick={() => { setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:bg-white/[0.04] transition-colors"
          >
            Melden
          </button>
          <button
            onClick={handleCopyLink}
            className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:bg-white/[0.04] transition-colors"
          >
            Link kopieren
          </button>
          <button
            onClick={() => { onShare(); setOpen(false); }}
            className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:bg-white/[0.04] transition-colors"
          >
            Teilen
          </button>
          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-t border-white/[0.06] ${
                confirmDelete ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' : 'text-red-500 hover:bg-white/[0.04]'
              } disabled:opacity-50`}
            >
              {deleting ? 'Wird gelöscht...' : confirmDelete ? 'Wirklich löschen?' : 'Löschen'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
