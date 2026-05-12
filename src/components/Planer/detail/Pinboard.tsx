'use client';

/**
 * Full-width pinboard that holds the plan's post-it notes.
 *
 * Board surface is a warm-dark felt texture. Notes are positioned via
 * percentage coordinates so the board stays responsive. Notes can be:
 *  - created (anyone in the group if `canCreate` is true)
 *  - dragged (only by their author)
 *  - edited (only by their author)
 *  - deleted (author or group creator)
 *
 * Realtime sync: subscribes to `group_pinboard_notes` channel for this
 * group so when one participant pins something, others see it appear
 * without refresh.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { PostitNote, type PostitData, type PostitColor } from './PostitNote';
import { PlanerButton, EditorialCaption } from '../primitives';

// fn-15.5: motion-lib overlay + spring scale-in replaced with CSS
// `animate-fade-in` + `animate-scale-pop`. The exit animation is
// dropped because the compose overlay closes on submit / cancel,
// when the page has already moved on perceptually.

// Palette that matches the app's accent system, used by the color picker
// swatches. Same gradients as the rendered note paper for visual consistency.
// Keys align with the DB CHECK constraint on group_pinboard_notes.color.
const SWATCH: Record<PostitColor, string> = {
  creme: '#d1bb82',
  sage: '#96bc9b',
  rose: '#c49398',
  lavender: '#a093b8',
};

interface PinboardProps {
  supabase: SupabaseClient;
  user: User;
  groupId: string;
  canCreate: boolean;        // false if pinboard_permission=owner_only and user is not owner
  isOwner: boolean;          // group creator (can delete any note)
}

const COLORS: PostitColor[] = ['creme', 'sage', 'rose', 'lavender'];

export function Pinboard({ supabase, user, groupId, canCreate, isOwner }: PinboardProps) {
  const [notes, setNotes] = useState<PostitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState<PostitColor>('creme');
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);

  // Clean up object URL when the preview changes or unmounts — otherwise
  // we'd leak blob URLs.
  useEffect(() => {
    return () => { if (newImagePreview) URL.revokeObjectURL(newImagePreview); };
  }, [newImagePreview]);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Nur Bilder'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max. 5 MB'); return; }
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewImage(file);
    setNewImagePreview(URL.createObjectURL(file));
  };

  const resetCompose = () => {
    if (newImagePreview) URL.revokeObjectURL(newImagePreview);
    setNewContent('');
    setNewImage(null);
    setNewImagePreview(null);
    setAdding(false);
  };

  // ─── Fetch existing notes ───
  // Note: we can't embed profiles via PostgREST's FK-hint syntax because
  // group_pinboard_notes.user_id references auth.users (not profiles).
  // Instead, fetch the notes, collect unique author ids, and batch-fetch
  // profiles in a second round-trip. One extra query, no 400s.
  const fetchNotes = useCallback(async () => {
    const { data: raw, error } = await supabase
      .from('group_pinboard_notes')
      .select('id, content, image_url, color, rotation, position_x, position_y, user_id, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[pinboard] fetch failed:', error);
      if (error.message.includes('does not exist') || error.message.includes('relation')) {
        toast.error('Pinnwand-Tabelle fehlt — Migration noch nicht appliziert.');
      } else {
        toast.error(`Pinnwand konnte nicht geladen werden: ${error.message}`);
      }
      setLoading(false);
      return;
    }

    if (!raw || raw.length === 0) {
      setNotes([]);
      setLoading(false);
      return;
    }

    // Enrich with profiles in a second query
    const userIds = [...new Set(raw.map(n => n.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, avatar_url')
      .in('id', userIds);
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    const enriched = raw.map(n => ({
      ...n,
      profile: profileMap.get(n.user_id)
        ? { first_name: profileMap.get(n.user_id)!.first_name, avatar_url: profileMap.get(n.user_id)!.avatar_url }
        : undefined,
    })) as PostitData[];
    setNotes(enriched);
    setLoading(false);
  }, [supabase, groupId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  // ─── Realtime subscription ───
  useEffect(() => {
    const channel = supabase
      .channel(`pinboard:${groupId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_pinboard_notes', filter: `group_id=eq.${groupId}` },
        () => { fetchNotes(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, groupId, fetchNotes]);

  // ─── CRUD operations ───
  const handleCreate = async () => {
    const content = newContent.trim();
    // DB constraint: either content or image_url must exist. Mirror in UI
    // so the user doesn't submit an empty note and get a cryptic 23514.
    if (!content && !newImage) return;

    setUploading(true);

    // Upload image first (if any) — get public URL to store on the note.
    // Reusing the existing group-images bucket under a pinboard/ prefix.
    let imageUrl: string | null = null;
    if (newImage) {
      const ext = newImage.name.split('.').pop() || 'jpg';
      const path = `pinboard/${groupId}/${user.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('group-images')
        .upload(path, newImage, { contentType: newImage.type, upsert: false });
      if (uploadErr) {
        console.error('[pinboard] upload failed:', uploadErr);
        toast.error('Bild-Upload fehlgeschlagen');
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('group-images').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    // Random position in a plausible spawn-zone (upper-center) so notes
    // don't all stack at exactly the same spot.
    const position_x = 35 + Math.random() * 25;
    const position_y = 10 + Math.random() * 15;
    const rotation = (Math.random() - 0.5) * 0.12; // ±0.06 rad
    const { error } = await supabase.from('group_pinboard_notes').insert({
      group_id: groupId,
      user_id: user.id,
      content: content || null,
      image_url: imageUrl,
      color: newColor,
      position_x,
      position_y,
      rotation,
    });
    if (error) {
      console.error('[pinboard] insert failed:', error);
      const hint = error.message.includes('row-level security')
        ? 'Keine Berechtigung — prüfe ob die Migration gelaufen ist und du Gruppen-Mitglied bist.'
        : error.message.includes('does not exist') || error.message.includes('relation')
        ? 'Tabelle fehlt. Die Migration wurde noch nicht appliziert.'
        : `Fehler: ${error.message}`;
      toast.error(hint);
      setUploading(false);
      return;
    }
    resetCompose();
    setUploading(false);
    fetchNotes();
  };

  const handleMove = async (id: string, x: number, y: number) => {
    // Optimistic update
    setNotes(prev => prev.map(n => n.id === id ? { ...n, position_x: x, position_y: y } : n));
    const { error } = await supabase
      .from('group_pinboard_notes')
      .update({ position_x: x, position_y: y })
      .eq('id', id);
    if (error) { console.error('[pinboard] move failed:', error); toast.error('Position nicht gespeichert'); }
  };

  const handleEdit = async (id: string, content: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content } : n));
    const { error } = await supabase.from('group_pinboard_notes').update({ content }).eq('id', id);
    if (error) { console.error('[pinboard] edit failed:', error); toast.error('Änderung nicht gespeichert'); }
  };

  const handleDelete = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    const { error } = await supabase.from('group_pinboard_notes').delete().eq('id', id);
    if (error) { console.error('[pinboard] delete failed:', error); toast.error('Konnte nicht gelöscht werden'); }
  };

  return (
    <section className="mt-12">
      {/* Section header */}
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <EditorialCaption className="mb-2">Pinnwand</EditorialCaption>
          <p className="text-sm text-[color:var(--color-planer-dim)] italic">
            {canCreate
              ? 'Notizen, Anfahrtsbilder, spontane Ideen. Klebt hin was euch einfällt.'
              : 'Lesezugriff — nur der Ersteller darf hier pinnen.'}
          </p>
        </div>
        {canCreate && (
          <PlanerButton
            onClick={() => setAdding(true)}
            size="md"
            variant="outline"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 5v14m7-7H5" />
            </svg>
            Post-it
          </PlanerButton>
        )}
      </div>

      {/* Board surface — warm dark felt */}
      <div
        ref={boardRef}
        className="relative rounded-2xl overflow-hidden border border-white/[0.05]"
        style={{
          minHeight: '460px',
          background: `
            radial-gradient(ellipse at 20% 10%, rgba(245,239,226,0.05) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(120,112,98,0.04) 0%, transparent 50%),
            linear-gradient(135deg, #0f0d0c 0%, #15120f 100%)
          `,
        }}
      >
        {/* Felt-grain texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.12 0 0 0 0 0.10 0 0 0 0 0.16 0 0 0 0.4 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`,
          }}
        />

        {/* Notes */}
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[color:var(--color-planer-whisper)] text-xs italic">Lade Notizen …</div>
          </div>
        ) : notes.length === 0 && !adding ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <svg className="w-10 h-10 text-[color:var(--color-planer-whisper)]" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
              <rect x="5" y="5" width="14" height="14" rx="1" />
              <path d="M9 9h6M9 13h4" />
            </svg>
            <p className="text-[color:var(--color-planer-dim)] text-sm italic max-w-xs">
              Noch keine Notizen — {canCreate ? 'kleb die erste hin.' : 'wartet auf die erste.'}
            </p>
          </div>
        ) : (
          notes.map(note => (
            <PostitNote
              key={note.id}
              note={note}
              boardRef={boardRef}
              isMine={note.user_id === user.id}
              isAdmin={isOwner}
              onMove={handleMove}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}

        {/* Add-note compose overlay */}
        {adding && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-[color:var(--color-planer-void)]/70 backdrop-blur-sm z-[200] animate-fade-in motion-reduce:animate-none"
            onClick={resetCompose}
          >
            <div
              className="w-[340px] max-w-[calc(100vw-2rem)] p-6 rounded-sm animate-scale-pop motion-reduce:animate-none"
                style={{
                  // Match the creme paper exactly (so compose view previews the note)
                  background: newColor === 'creme' ? 'linear-gradient(135deg, #dcc990 0%, #c4ae70 100%)'
                    : newColor === 'sage' ? 'linear-gradient(135deg, #aac8ab 0%, #86a98a 100%)'
                    : newColor === 'rose' ? 'linear-gradient(135deg, #d2a6ab 0%, #b17d85 100%)'
                    : 'linear-gradient(135deg, #b2a4c4 0%, #8f7ea5 100%)',
                  boxShadow: '0 20px 50px -20px rgba(0,0,0,0.6), 0 8px 20px -8px rgba(0,0,0,0.2)',
                  transform: 'rotate(-1deg)',
                  transition: 'background 0.3s ease',
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Image preview (if picked) — sits above the textarea */}
                {newImagePreview && (
                  <div className="relative mb-3 rounded-sm overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={newImagePreview}
                      alt=""
                      className="w-full h-32 object-cover"
                      draggable={false}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newImagePreview) URL.revokeObjectURL(newImagePreview);
                        setNewImage(null);
                        setNewImagePreview(null);
                      }}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm"
                      aria-label="Bild entfernen"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                <textarea
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder={newImagePreview ? 'Bildunterschrift (optional)…' : 'Schreib was drauf …'}
                  autoFocus
                  rows={newImagePreview ? 2 : 5}
                  className="w-full bg-transparent resize-none outline-none text-base leading-relaxed placeholder-black/25"
                  style={{
                    color: newColor === 'creme' ? '#3e3010'
                      : newColor === 'sage' ? '#1e2d1f'
                      : newColor === 'rose' ? '#2a1416'
                      : '#1e1628',
                    fontFamily: 'var(--font-caveat), "Segoe Script", cursive',
                    fontSize: '19px',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleCreate();
                    if (e.key === 'Escape') resetCompose();
                  }}
                />

                {/* Toolbar: color picker on the left, image-attach on the right */}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {COLORS.map(c => {
                      const active = newColor === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          className="relative w-7 h-7 rounded-full transition-all hover:scale-110"
                          style={{
                            background: SWATCH[c],
                            boxShadow: active
                              ? '0 0 0 2px rgba(0,0,0,0.85), 0 0 0 4px rgba(255,255,255,0.4)'
                              : '0 0 0 1px rgba(0,0,0,0.15)',
                          }}
                          aria-label={c}
                          aria-pressed={active}
                        >
                          {active && (
                            <svg
                              className="absolute inset-0 m-auto w-3.5 h-3.5"
                              fill="none" stroke="#1a1a1a" strokeWidth={3} viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* Image-attach button */}
                  <label
                    className="relative w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                    style={{
                      background: 'rgba(0,0,0,0.12)',
                      color: newColor === 'creme' ? '#3e3010'
                        : newColor === 'sage' ? '#1e2d1f'
                        : newColor === 'rose' ? '#2a1416'
                        : '#1e1628',
                    }}
                    title="Bild anhängen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImagePick}
                    />
                  </label>
                </div>

                {/* Actions — clean text links, no pill buttons (paper aesthetic) */}
                <div className="mt-5 flex items-center justify-end gap-5">
                  <button
                    type="button"
                    onClick={resetCompose}
                    className="text-[13px] opacity-60 hover:opacity-100 transition-opacity"
                    style={{
                      color: newColor === 'creme' ? '#3e3010'
                        : newColor === 'sage' ? '#1e2d1f'
                        : newColor === 'rose' ? '#2a1416'
                        : '#1e1628',
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={uploading || (!newContent.trim() && !newImage)}
                    className="text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed hover:gap-2 transition-all"
                    style={{
                      color: newColor === 'creme' ? '#3e3010'
                        : newColor === 'sage' ? '#1e2d1f'
                        : newColor === 'rose' ? '#2a1416'
                        : '#1e1628',
                    }}
                  >
                    {uploading ? 'Lade hoch …' : 'Anpinnen'}
                    {!uploading && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
          </div>
        )}
      </div>

      {/* Ownership hint */}
      {isOwner && (
        <p className="mt-3 text-[10px] text-[color:var(--color-planer-whisper)] italic">
          Als Ersteller kannst du alle Post-its moderieren und die Pinn-Rechte in den Plan-Einstellungen ändern.
        </p>
      )}
    </section>
  );
}
