'use client';

interface FeedActivityIconProps {
  type: string;
  className?: string;
}

export function FeedActivityIcon({ type, className = 'w-4 h-4' }: FeedActivityIconProps) {
  switch (type) {
    case 'event_saved':
      return (
        <svg className={className} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 'event_created':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      );
    case 'event_shared':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="18" cy="5" r="3" strokeWidth={2} />
          <circle cx="6" cy="12" r="3" strokeWidth={2} />
          <circle cx="18" cy="19" r="3" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
        </svg>
      );
    case 'event_attended':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'group_joined':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case 'friend_added':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      );
    case 'post':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" strokeWidth={2} />
        </svg>
      );
  }
}

const TYPE_COLORS: Record<string, string> = {
  event_saved: 'bg-rose-500/20 text-rose-400',
  event_created: 'bg-emerald-500/20 text-emerald-400',
  event_shared: 'bg-blue-500/20 text-blue-400',
  event_attended: 'bg-amber-500/20 text-amber-400',
  group_joined: 'bg-purple-500/20 text-purple-400',
  friend_added: 'bg-cyan-500/20 text-cyan-400',
  memory_created: 'bg-pink-500/20 text-pink-400',
  post: 'bg-indigo-500/20 text-indigo-400',
};

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || 'bg-white/10 text-white/50';
}
