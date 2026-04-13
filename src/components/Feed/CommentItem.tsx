'use client';

import { useState, useRef, useEffect } from 'react';
import { formatRelativeTime } from './feed-types';

interface CommentItemProps {
  comment: {
    id: string;
    content: string;
    created_at: string;
    user_id?: string;
    user: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    };
  };
  currentUserId?: string | null;
  postOwnerId?: string;
  onDeleted?: (commentId: string) => void;
}

export function CommentItem({ comment, currentUserId, postOwnerId, onDeleted }: CommentItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwnComment = currentUserId && comment.user_id === currentUserId;
  const isPostOwner = currentUserId && postOwnerId === currentUserId;
  const canDelete = isOwnComment || isPostOwner;
  const canReport = currentUserId && !isOwnComment;
  const showMenu = canDelete || canReport;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
      if (res.ok) {
        onDeleted?.(comment.id);
      }
    } finally {
      setLoading(false);
      setMenuOpen(false);
      setConfirmDelete(false);
    }
  };

  const handleReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments/${comment.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reportReason }),
      });
      if (res.ok) {
        setReportSent(true);
        setTimeout(() => {
          setReportOpen(false);
          setReportSent(false);
          setReportReason('');
          setMenuOpen(false);
        }, 1500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2.5 group">
      {/* Avatar */}
      {comment.user.avatar_url ? (
        <img
          src={comment.user.avatar_url}
          alt=""
          className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10 shrink-0"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-white/[0.08] ring-1 ring-white/10 flex items-center justify-center text-xs font-semibold text-white/50 shrink-0">
          {comment.user.first_name?.[0]?.toUpperCase() || '?'}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white/80">
          {comment.user.first_name} {comment.user.last_name}
        </p>
        <p className="text-sm text-white/60 mt-0.5 whitespace-pre-wrap break-words">
          {comment.content}
        </p>
        <span className="text-[10px] text-white/20 mt-1 block">
          {formatRelativeTime(comment.created_at)}
        </span>
      </div>

      {/* Menu */}
      {showMenu && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => { setMenuOpen(!menuOpen); setConfirmDelete(false); setReportOpen(false); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
            aria-label="Kommentar-Optionen"
          >
            <svg className="w-4 h-4 text-white/30" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {menuOpen && !reportOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl border border-white/10 bg-gray-900 py-1 z-50 animate-fade-in-up">
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    confirmDelete
                      ? 'text-red-400 bg-red-500/10 font-medium'
                      : 'text-red-400 hover:bg-white/5'
                  }`}
                >
                  {loading ? 'Wird geloescht...' : confirmDelete ? 'Wirklich loeschen?' : 'Loeschen'}
                </button>
              )}
              {canReport && (
                <button
                  onClick={() => setReportOpen(true)}
                  className="w-full text-left px-3 py-2 text-sm text-white/60 hover:bg-white/5 transition-colors"
                >
                  Melden
                </button>
              )}
            </div>
          )}

          {/* Report Dialog */}
          {menuOpen && reportOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 rounded-lg shadow-xl border border-white/10 bg-gray-900 p-3 z-50 animate-fade-in-up">
              {reportSent ? (
                <p className="text-sm text-green-400 text-center py-2">Kommentar gemeldet</p>
              ) : (
                <>
                  <p className="text-xs text-white/50 mb-2">Warum meldest du diesen Kommentar?</p>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Grund (optional)"
                    className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-sm text-white/70 placeholder:text-white/20 resize-none focus:outline-none focus:ring-1 focus:ring-white/20"
                    rows={2}
                    maxLength={200}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => { setReportOpen(false); setReportReason(''); }}
                      className="flex-1 text-xs text-white/40 hover:text-white/60 py-1.5 rounded transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleReport}
                      disabled={loading}
                      className="flex-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 py-1.5 rounded font-medium transition-colors"
                    >
                      {loading ? '...' : 'Melden'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
