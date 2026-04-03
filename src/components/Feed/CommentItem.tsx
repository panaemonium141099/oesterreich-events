'use client';

import { formatRelativeTime } from './feed-types';

interface CommentItemProps {
  comment: {
    id: string;
    content: string;
    created_at: string;
    user: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    };
  };
}

export function CommentItem({ comment }: CommentItemProps) {
  return (
    <div className="flex gap-2.5">
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
    </div>
  );
}
