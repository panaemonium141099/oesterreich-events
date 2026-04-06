'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/supabase/auth-context';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
  uploader?: { first_name: string; last_name: string; avatar_url: string | null };
}

interface Participant {
  id: string;
  user_id: string;
  profile: { id: string; first_name: string; last_name: string; avatar_url: string | null };
}

interface MemoryDetail {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  event_id: string | null;
  created_at: string;
  event?: { id: string; title: string; start_date: string; location_name: string | null; image_url: string | null } | null;
  creator?: { first_name: string; last_name: string; avatar_url: string | null };
}

export default function MemoryDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const memoryId = params.id as string;
  const supabase = createClient();

  const [memory, setMemory] = useState<MemoryDetail | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  const fetchMemory = useCallback(async () => {
    if (!user || !memoryId) return;
    setLoadingData(true);

    const { data: m } = await supabase
      .from('memories')
      .select('id, title, description, created_by, event_id, created_at')
      .eq('id', memoryId)
      .single();

    if (!m) {
      router.push('/memories');
      return;
    }

    // Get event if linked
    let event = null;
    if (m.event_id) {
      const { data: e } = await supabase
        .from('events')
        .select('id, title, start_date, location_name, image_url')
        .eq('id', m.event_id)
        .single();
      event = e;
    }

    // Get creator
    const { data: creator } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar_url')
      .eq('id', m.created_by)
      .single();

    setMemory({ ...m, event, creator: creator || undefined });
    setEditTitle(m.title || '');
    setEditDesc(m.description || '');

    // Photos
    const { data: photosData } = await supabase
      .from('memory_photos')
      .select('id, image_url, caption, uploaded_by, created_at')
      .eq('memory_id', memoryId)
      .order('created_at', { ascending: true });

    if (photosData) {
      const enrichedPhotos = await Promise.all(
        photosData.map(async (p: any) => {
          const { data: uploader } = await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url')
            .eq('id', p.uploaded_by)
            .single();
          return { ...p, uploader };
        })
      );
      setPhotos(enrichedPhotos as Photo[]);
    }

    // Participants
    const { data: parts } = await supabase
      .from('memory_participants')
      .select('id, user_id, profile:profiles!memory_participants_user_id_fkey(id, first_name, last_name, avatar_url)')
      .eq('memory_id', memoryId);

    setParticipants(
      ((parts as any) || []).map((p: any) => ({
        ...p,
        profile: Array.isArray(p.profile) ? p.profile[0] : p.profile,
      }))
    );

    setLoadingData(false);
  }, [user, memoryId, supabase, router]);

  useEffect(() => {
    if (user) fetchMemory();
  }, [user, fetchMemory]);

  const handleUploadPhotos = async (files: FileList) => {
    if (!user || !memoryId) return;
    setUploading(true);

    let uploadFailCount = 0;
    const totalFiles = files.length;

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${memoryId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      try {
        const { error: uploadErr } = await supabase.storage
          .from('memories')
          .upload(path, file);

        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('memories').getPublicUrl(path);
        await supabase.from('memory_photos').insert({
          memory_id: memoryId,
          uploaded_by: user.id,
          image_url: urlData.publicUrl,
        });
      } catch {
        uploadFailCount++;
      }
    }

    if (uploadFailCount > 0) {
      toast.error(`${uploadFailCount} Foto${uploadFailCount > 1 ? 's' : ''} konnte${uploadFailCount > 1 ? 'n' : ''} nicht hochgeladen werden`);
    } else if (totalFiles > 0) {
      toast.success(`${totalFiles} Foto${totalFiles > 1 ? 's' : ''} hochgeladen`);
    }

    setUploading(false);
    await fetchMemory();
  };

  const handleSave = async () => {
    if (!memory) return;
    setSaving(true);
    await supabase
      .from('memories')
      .update({ title: editTitle, description: editDesc || null })
      .eq('id', memory.id);
    setSaving(false);
    setEditing(false);
    await fetchMemory();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('de-AT', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const Avatar = ({ url, name, size = 'md' }: { url: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) => {
    const s = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-xs';
    return url ? (
      <img src={url} alt="" className={`${s} rounded-full object-cover`} />
    ) : (
      <div className={`${s} rounded-full bg-white/10 flex items-center justify-center font-semibold text-white/60`}>
        {name?.[0]?.toUpperCase() || '?'}
      </div>
    );
  };

  const isCreator = memory?.created_by === user?.id;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-elevated text-white">
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="h-4 bg-white/[0.06] rounded w-24 animate-pulse motion-reduce:animate-none" />
          <div className="h-3 bg-white/[0.06] rounded w-16 animate-pulse motion-reduce:animate-none" />
        </header>
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 animate-pulse motion-reduce:animate-none">
          <div className="h-7 bg-white/[0.06] rounded w-2/3" />
          <div className="h-4 bg-white/[0.04] rounded w-1/3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-square rounded-xl bg-white/[0.06]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="min-h-screen text-white bg-surface-elevated">
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="h-4 bg-white/[0.06] rounded w-24 animate-pulse motion-reduce:animate-none" />
          <div className="h-3 bg-white/[0.06] rounded w-16 animate-pulse motion-reduce:animate-none" />
        </header>
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6 animate-pulse motion-reduce:animate-none">
          <div className="h-7 bg-white/[0.06] rounded w-2/3" />
          <div className="h-4 bg-white/[0.04] rounded w-1/3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-square rounded-xl bg-white/[0.06]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!memory) return null;

  return (
    <div
      className="min-h-screen text-white bg-surface-elevated"
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <Link href="/memories" className="text-white/40 hover:text-white transition-colors text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Alle Memories
        </Link>
        <p className="text-xs tracking-[0.2em] uppercase text-white/30">Memory</p>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-xl font-bold focus:outline-none focus:border-white/30 transition-colors"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none"
                placeholder="Beschreibung..."
              />
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm text-white/40 hover:text-white transition-colors">
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
                >
                  {saving ? '...' : 'Speichern'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{memory.title}</h1>
                  <p className="text-white/40 text-sm mt-1">{formatDate(memory.created_at)}</p>
                </div>
                {isCreator && (
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white hover:border-white/20 transition-colors"
                  >
                    Bearbeiten
                  </button>
                )}
              </div>
              {memory.description && (
                <p className="text-white/60 text-sm mt-3 leading-relaxed">{memory.description}</p>
              )}
            </>
          )}
        </div>

        {/* Linked Event */}
        {memory.event && (
          <Link
            href={`/events/${memory.event.id}`}
            className="block mb-8 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/20 transition-colors"
          >
            <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Verkn&uuml;pftes Event</p>
            <div className="flex items-center gap-3">
              {memory.event.image_url && (
                <img src={memory.event.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
              )}
              <div>
                <p className="text-sm font-medium">{memory.event.title}</p>
                <p className="text-xs text-white/40">
                  {formatDate(memory.event.start_date)}
                  {memory.event.location_name && ` \u2022 ${memory.event.location_name}`}
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* Participants */}
        {participants.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-3">Teilnehmer</h2>
            <div className="flex flex-wrap gap-3">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <Avatar url={p.profile?.avatar_url} name={p.profile?.first_name || '?'} size="sm" />
                  <span className="text-sm">{p.profile?.first_name} {p.profile?.last_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Creator */}
        {memory.creator && (
          <div className="mb-8 flex items-center gap-2 text-xs text-white/30">
            <Avatar url={memory.creator.avatar_url} name={memory.creator.first_name} size="sm" />
            <span>Erstellt von {memory.creator.first_name} {memory.creator.last_name}</span>
          </div>
        )}

        {/* Photo Gallery */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium">
              Fotos ({photos.length})
            </h2>
            <label className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-white/60 hover:text-white hover:border-white/20 transition-colors cursor-pointer flex items-center gap-1.5">
              {uploading ? (
                <div className="w-3 h-3 border border-white/20 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              Foto hinzuf&uuml;gen
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleUploadPhotos(e.target.files);
                }}
                disabled={uploading}
              />
            </label>
          </div>

          {photos.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-white/10">
              <svg className="w-8 h-8 text-white/10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-white/20">Noch keine Fotos hochgeladen</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setLightboxIndex(i)}
                  className="aspect-square rounded-xl overflow-hidden hover:opacity-80 transition-opacity"
                >
                  <img src={p.image_url} alt={p.caption || ''} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Timeline View */}
        {photos.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm uppercase tracking-[0.15em] text-white/40 font-medium mb-4">Timeline</h2>
            <div className="space-y-6 relative before:absolute before:left-4 before:top-0 before:bottom-0 before:w-px before:bg-white/10">
              {photos.map((p) => (
                <div key={p.id} className="flex gap-4 pl-10 relative">
                  <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-white/20 border-2 border-black" />
                  <div className="flex-1">
                    <img
                      src={p.image_url}
                      alt={p.caption || ''}
                      className="w-full max-w-md rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setLightboxIndex(photos.indexOf(p))}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      {p.uploader && (
                        <div className="flex items-center gap-1.5">
                          <Avatar url={p.uploader.avatar_url} name={p.uploader.first_name} size="sm" />
                          <span className="text-xs text-white/30">{p.uploader.first_name}</span>
                        </div>
                      )}
                      <span className="text-xs text-white/20">{formatDateTime(p.created_at)}</span>
                    </div>
                    {p.caption && <p className="text-sm text-white/60 mt-1">{p.caption}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors z-10"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {lightboxIndex < photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <img
            src={photos[lightboxIndex].image_url}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/40">
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
