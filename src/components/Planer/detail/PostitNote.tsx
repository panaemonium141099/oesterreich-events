'use client';

/**
 * Single sticky-note on the pinboard.
 *
 * - Absolutely positioned within the board via position_x / position_y
 *   (percentages of board dimensions — responsive for free).
 * - Small random rotation for "stuck on" feel.
 * - Drag to reposition — fn-15.5: now driven by pointer events + CSS
 *   transform instead of motion-lib's drag system. Same UX: grab,
 *   drag, drop snaps to nearest %.
 * - Click to edit (owner only).
 * - Soft paper color + subtle shadow; intentionally NOT neon, NOT candy.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import { toast } from 'sonner';

export type PostitColor = 'creme' | 'sage' | 'rose' | 'lavender';

export interface PostitData {
  id: string;
  content: string | null;
  image_url: string | null;
  color: PostitColor;
  rotation: number;       // radians
  position_x: number;     // 0-100
  position_y: number;     // 0-100
  user_id: string;
  created_at: string;
  profile?: { first_name: string; avatar_url: string | null };
}

interface PostitNoteProps {
  note: PostitData;
  boardRef: RefObject<HTMLDivElement | null>;
  /**
   * True when the current user is the author of THIS note. Only authors
   * can drag, edit, or delete their own notes. Separate from the board's
   * create-permission (owner-only boards still let existing authors edit
   * their previously-pinned notes).
   */
  isMine: boolean;
  /**
   * True when the current user is the group creator. Admin rights = can
   * delete any note on the board (moderation safety net). Admin CANNOT
   * edit other users' notes (author-only).
   */
  isAdmin: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

// Paper-inspired palette — four muted hues for variety on the board.
// The rest of the app is monochrome, but post-its keep color because they
// need to be visually distinguishable at a glance. All four sit around
// L~70 C~15-20 so they read as cousins, not as competing primaries.
//   creme    — warm ochre (family of --color-planer-maybe)
//   sage     — muted green (family of --color-planer-sage)
//   rose     — dusty pink (family of --color-planer-rose)
//   lavender — muted plum (intentional on the sticky palette — the user
//              explicitly opted to keep a purple paper option even after
//              the primary app accent dropped plum)
const COLOR_STYLE: Record<PostitColor, { bg: string; shadow: string; ink: string; inkSoft: string }> = {
  creme: {
    bg: 'linear-gradient(135deg, #dcc990 0%, #c4ae70 100%)',
    shadow: '0 10px 24px -10px rgba(0,0,0,0.55), 0 4px 10px -4px rgba(196, 174, 112, 0.22)',
    ink: '#3e3010',
    inkSoft: '#6e5a2a',
  },
  sage: {
    bg: 'linear-gradient(135deg, #aac8ab 0%, #86a98a 100%)',
    shadow: '0 10px 24px -10px rgba(0,0,0,0.55), 0 4px 10px -4px rgba(134, 169, 138, 0.22)',
    ink: '#1e2d1f',
    inkSoft: '#3d5a3f',
  },
  rose: {
    bg: 'linear-gradient(135deg, #d2a6ab 0%, #b17d85 100%)',
    shadow: '0 10px 24px -10px rgba(0,0,0,0.55), 0 4px 10px -4px rgba(177, 125, 133, 0.22)',
    ink: '#2a1416',
    inkSoft: '#5a2d34',
  },
  lavender: {
    bg: 'linear-gradient(135deg, #b2a4c4 0%, #8f7ea5 100%)',
    shadow: '0 10px 24px -10px rgba(0,0,0,0.55), 0 4px 10px -4px rgba(143, 126, 165, 0.22)',
    ink: '#1e1628',
    inkSoft: '#3d2e54',
  },
};

export function PostitNote({ note, boardRef, isMine, isAdmin, onMove, onEdit, onDelete }: PostitNoteProps) {
  const canDelete = isMine || isAdmin;
  // fn-15.5: instead of framer's useMotionValue, the drag translate is a
  // local state pair that we reset to 0 after dragend (same effect as
  // before — the new left/top % is the only source of truth).
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  // Track whether a real drag just happened, so the `click` event that
  // browsers fire on mouseup doesn't also trigger edit-mode. Without this,
  // a fast drag ends → click bubbles → textarea mounts + auto-selects →
  // user sees the text highlighted in blue after releasing.
  const wasDraggedRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const style = COLOR_STYLE[note.color];

  // Commit position after drag ends, then reset the drag translate.
  // Order matters: first update parent state so the note's left/top % pulls
  // it to the new position on re-render, then wipe the translate so the
  // transform doesn't double-apply on top of the new anchor.
  const commitDrag = useCallback(
    (offsetX: number, offsetY: number) => {
      const board = boardRef.current;
      if (board) {
        const rect = board.getBoundingClientRect();
        const newX = ((note.position_x / 100) * rect.width + offsetX) / rect.width * 100;
        const newY = ((note.position_y / 100) * rect.height + offsetY) / rect.height * 100;
        const clampedX = Math.max(0, Math.min(95, newX));
        const clampedY = Math.max(0, Math.min(95, newY));
        onMove(note.id, clampedX, clampedY);
      }
      setDragOffset({ x: 0, y: 0 });
      // Nuke any accidental browser-level text selection the drag motion
      // may have triggered in WebKit.
      window.getSelection()?.removeAllRanges();
      // Keep the drag flag up for a tick so the synthetic click event that
      // fires on mouseup doesn't sneak through and open edit mode.
      setTimeout(() => { wasDraggedRef.current = false; }, 50);
    },
    [boardRef, note.id, note.position_x, note.position_y, onMove],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMine) return;
    // Skip drags initiated on action buttons / textarea — only the paper
    // itself should be grabbable.
    if (
      e.target instanceof HTMLElement &&
      (e.target.tagName === 'BUTTON' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.closest('button') ||
        e.target.closest('textarea'))
    ) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    wasDraggedRef.current = true;
    dragStartRef.current = { clientX: e.clientX, clientY: e.clientY };

    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      setDragOffset({ x: ev.clientX - startX, y: ev.clientY - startY });
    };
    const onUp = (ev: PointerEvent) => {
      setDragging(false);
      commitDrag(ev.clientX - startX, ev.clientY - startY);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleTextClick = () => {
    if (wasDraggedRef.current) return;   // click was really the tail of a drag
    if (isMine) setEditing(true);
  };

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end — do NOT select all. Auto-select used to
      // make a drag-then-accidental-click look like "the text stays
      // highlighted after I dropped the note" which was confusing.
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const commitEdit = () => {
    if (draft.trim() && draft !== note.content) onEdit(note.id, draft.trim());
    setEditing(false);
  };

  const rotationDeg = (note.rotation * 180) / Math.PI;
  const hoverScale = dragging ? 1.06 : 1;

  return (
    <div
      onPointerDown={onPointerDown}
      className={[
        'absolute rounded-[3px] select-none overflow-hidden',
        'flex flex-col motion-reduce:!transition-none',
        // CSS scale-on-hover for the gentle 1.01/1.03 lift the framer
        // whileHover provided. Skipped during drag (handled inline below).
        isMine ? 'cursor-grab active:cursor-grabbing hover:scale-[1.03]' : 'cursor-pointer hover:scale-[1.01]',
      ].join(' ')}
      style={{
        left: `${note.position_x}%`,
        top: `${note.position_y}%`,
        width: '168px',
        minHeight: '160px',
        background: style.bg,
        boxShadow: style.shadow,
        color: style.ink,
        // Compose the drag translate, rotation, and hover scale into a
        // single transform so they don't fight each other.
        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotationDeg}deg) scale(${hoverScale})`,
        transition: dragging
          ? 'none'
          : 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease',
        zIndex: dragging ? 100 : undefined,
        // Initial mount: tiny scale-pop from 0.85 → 1. Pure CSS, runs once.
        animation: 'postit-mount 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}
    >
      {/* Paper grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.2 0 0 0 0 0.15 0 0 0 0 0.08 0 0 0 0.3 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }}
      />

      {/* Content */}
      <div className="relative flex-1 p-4 flex flex-col">
        {note.image_url ? (
          // Image note — fills, rest of the note is ambient
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={note.image_url}
              alt=""
              className="w-full h-24 object-cover rounded-sm mb-2"
              draggable={false}
            />
            {note.content && (
              <p className="text-[11px] leading-snug" style={{ color: style.ink, fontFamily: 'var(--font-caveat), "Segoe Script", cursive' }}>
                {note.content}
              </p>
            )}
          </>
        ) : editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setDraft(note.content ?? ''); setEditing(false); }
              if (e.key === 'Enter' && e.metaKey) commitEdit();
            }}
            className="flex-1 w-full bg-transparent resize-none outline-none text-sm leading-relaxed"
            style={{ color: style.ink, fontFamily: 'var(--font-caveat), "Segoe Script", cursive', fontSize: '16px' }}
            rows={4}
          />
        ) : (
          <p
            onClick={handleTextClick}
            className="flex-1 text-sm leading-relaxed whitespace-pre-wrap break-words select-none cursor-pointer"
            style={{ color: style.ink, fontFamily: 'var(--font-caveat), "Segoe Script", cursive', fontSize: '16px' }}
          >
            {note.content || (isMine ? 'Tap zum Schreiben' : '')}
          </p>
        )}

        {/* Footer — tiny author initial */}
        {note.profile && (
          <div className="mt-2 flex items-center gap-1.5 text-[9px] uppercase tracking-wider" style={{ color: style.ink, opacity: 0.55 }}>
            <span className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px]" style={{ background: style.ink, color: style.bg.includes('#f3') ? '#f3e8c9' : '#fff' }}>
              {note.profile.first_name[0]?.toUpperCase()}
            </span>
            <span className="truncate max-w-[80px]">{note.profile.first_name}</span>
          </div>
        )}

        {/* Action icons — top-right corner.
              - Copy: everyone, always (one click → clipboard).
              - Delete: author OR plan admin only. */}
        {!editing && (
          <div className="absolute top-1 right-1 flex items-center gap-0.5">
            {note.content && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(note.content ?? '').then(
                    () => toast.success('Kopiert'),
                    () => toast.error('Konnte nicht kopieren'),
                  );
                }}
                className="w-5 h-5 rounded-full bg-black/10 hover:bg-black/25 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Text kopieren"
                title="Kopieren"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" style={{ color: style.ink }}>
                  <rect x="9" y="9" width="11" height="11" rx="1.5" />
                  <path d="M5 15V5a2 2 0 012-2h8" />
                </svg>
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (confirm('Post-it löschen?')) onDelete(note.id); }}
                className="w-5 h-5 rounded-full bg-black/10 hover:bg-black/25 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Löschen"
                title="Löschen"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: style.ink }}>
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
