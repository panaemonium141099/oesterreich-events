'use client';

import { useState, forwardRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface InlineCommentInputProps {
  activityId: string;
  userId: string;
  userAvatar: string | null;
  userInitial: string;
  activityOwnerId: string;
  onCommentAdded: (comment: { id: string; content: string; created_at: string; user: { first_name: string; last_name: string; avatar_url: string | null } }) => void;
}

export const InlineCommentInput = forwardRef<HTMLInputElement, InlineCommentInputProps>(
  function InlineCommentInput({ activityId, userId, userAvatar, userInitial, activityOwnerId, onCommentAdded }, ref) {
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const supabase = createClient();

    const handleSubmit = async () => {
      const trimmed = text.trim();
      if (!trimmed || submitting) return;

      setSubmitting(true);
      const { data, error } = await supabase
        .from('activity_comments')
        .insert({ activity_id: activityId, user_id: userId, content: trimmed })
        .select('id, content, created_at')
        .single();

      if (!error && data) {
        // Send notification to post owner (not to self)
        if (activityOwnerId !== userId) {
          await supabase.from('notifications').insert({
            user_id: activityOwnerId,
            from_user_id: userId,
            type: 'comment',
            title: 'hat deinen Beitrag kommentiert',
            body: trimmed.length > 80 ? trimmed.slice(0, 80) + '...' : trimmed,
            action_url: '/feed/' + activityId,
          });
        }

        // Get current user profile for optimistic update
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url')
          .eq('id', userId)
          .single();

        onCommentAdded({
          id: data.id,
          content: data.content,
          created_at: data.created_at,
          user: profile || { first_name: 'Du', last_name: '', avatar_url: null },
        });

        setText('');
      }
      setSubmitting(false);
    };

    return (
      <div className="flex items-center gap-3 px-4 py-2.5">
        {userAvatar ? (
          <img src={userAvatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-medium text-slate-500 shrink-0">
            {userInitial}
          </div>
        )}
        <input
          ref={ref}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
          placeholder="Kommentar hinzufügen..."
          className="flex-1 bg-transparent text-sm text-slate-600 placeholder-slate-400 outline-none"
          disabled={submitting}
        />
        {text.trim() && (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 shrink-0"
          >
            Posten
          </button>
        )}
      </div>
    );
  }
);
