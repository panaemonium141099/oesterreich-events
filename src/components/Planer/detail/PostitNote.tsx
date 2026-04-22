'use client';

/**
 * Single sticky-note on the pinboard.
 *
 * - Absolutely positioned within the board via position_x / position_y
 *   (percentages of board dimensions — responsive for free).
 * - Small random rotation for "stuck on" feel.
 * - Drag to reposition (Framer Motion drag) — persisted on drop.
 * - Click to edit (owner only).
 * - Soft paper color + subtle shadow; intentionally NOT neon, NOT candy.
 */

import { motion, type PanInfo } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import type { RefObject } from 'react';

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
  canEdit: boolean;
  isMine: boolean;
  onMove: (id: string, x: number, y: number) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

// Paper-inspired palette — muted hues aligned with the app's accent system.
// All four sit around L~70 C~20 so they read as cousins on the board;
// hue is the only thing separating them. No candy pastels, no Day-Glo.
//   creme   ← family of --color-planer-maybe (#c9a86a, warm ochre)
//   sage    ← family of --color-planer-sage (#7bb794)
//   rose    ← family of --color-planer-rose (#c67079)
//   lavender← family of --color-planer-accent (#8a7aa4, muted plum)
// DB key "lavender" kept so the existing CHECK constraint still passes.
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

export function PostitNote({ note, boardRef, canEdit, isMine, onMove, onEdit, onDelete }: PostitNoteProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const style = COLOR_STYLE[note.color];

  // Commit position after drag ends
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const board = boardRef.current;
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const newX = ((note.position_x / 100) * rect.width + info.offset.x) / rect.width * 100;
    const newY = ((note.position_y / 100) * rect.height + info.offset.y) / rect.height * 100;
    onMove(note.id, Math.max(0, Math.min(95, newX)), Math.max(0, Math.min(95, newY)));
  };

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const commitEdit = () => {
    if (draft.trim() && draft !== note.content) onEdit(note.id, draft.trim());
    setEditing(false);
  };

  return (
    <motion.div
      drag={isMine}
      dragMomentum={false}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.85, rotate: 0 }}
      animate={{
        opacity: 1,
        scale: 1,
        rotate: `${(note.rotation * 180) / Math.PI}deg`,
      }}
      whileHover={isMine ? { scale: 1.03, zIndex: 50 } : { scale: 1.01 }}
      whileDrag={{ scale: 1.06, zIndex: 100, cursor: 'grabbing' }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={[
        'absolute rounded-[3px] select-none overflow-hidden',
        'flex flex-col',
        isMine ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
      ].join(' ')}
      style={{
        left: `${note.position_x}%`,
        top: `${note.position_y}%`,
        width: '168px',
        minHeight: '160px',
        background: style.bg,
        boxShadow: style.shadow,
        color: style.ink,
      }}
    >
      {/* Paper grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20 mix-blend-multiply"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.2 0 0 0 0 0.15 0 0 0 0 0.08 0 0 0 0.3 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
        }}
      />

      {/* Pin thumbtack */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full z-10"
        style={{
          background: 'radial-gradient(circle at 30% 30%, #c8a2c8, #6b4a6b 70%, #3a2a3a 100%)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.3)',
        }}
      />

      {/* Content */}
      <div className="relative flex-1 p-4 pt-6 flex flex-col">
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
            onClick={() => canEdit && isMine && setEditing(true)}
            className={`flex-1 text-sm leading-relaxed whitespace-pre-wrap break-words ${isMine ? 'cursor-text' : ''}`}
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

        {/* Delete X — visible on hover, owner only */}
        {isMine && !editing && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (confirm('Post-it löschen?')) onDelete(note.id); }}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/10 hover:bg-black/25 flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
            aria-label="Löschen"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: style.ink }}>
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
}
