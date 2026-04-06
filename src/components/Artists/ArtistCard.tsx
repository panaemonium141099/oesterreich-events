'use client';

interface ArtistCardProps {
  name: string;
  imageUrl?: string | null;
  genres?: string[];
  popularity?: number | null;
  isFollowed: boolean;
  isLoading?: boolean;
  source?: 'spotify' | 'manual';
  rank?: number | null;
  onToggleFollow: () => void;
}

export function ArtistCard({
  name,
  imageUrl,
  genres,
  popularity,
  isFollowed,
  isLoading,
  source,
  rank,
  onToggleFollow,
}: ArtistCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.10] transition-colors">
      {/* Artist image */}
      <div className="w-12 h-12 rounded-full bg-white/[0.06] flex-shrink-0 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/50 text-lg font-semibold">
            {name[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      {/* Artist info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white/90 truncate">{name}</p>
          {rank != null && rank <= 10 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-400 font-medium shrink-0">
              Top {rank}
            </span>
          )}
        </div>
        {genres && genres.length > 0 && (
          <p className="text-xs text-white/40 truncate mt-0.5">
            {genres.slice(0, 3).join(', ')}
          </p>
        )}
        {source && (
          <p className="text-[10px] text-white/30 mt-0.5">
            {source === 'spotify' ? 'Spotify' : 'Manuell'}
          </p>
        )}
      </div>

      {/* Follow/Unfollow button */}
      <button
        onClick={onToggleFollow}
        disabled={isLoading}
        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          isFollowed
            ? 'bg-white/[0.06] text-white/50 hover:bg-red-500/20 hover:text-red-400'
            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current/20 border-t-current rounded-full animate-spin" />
        ) : isFollowed ? (
          'Entfolgen'
        ) : (
          'Folgen'
        )}
      </button>
    </div>
  );
}
