import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/comments/[id]
 * Delete a comment. Allowed if:
 *   - Current user is the comment author, OR
 *   - Current user is the post (activity) owner
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the comment to check ownership
    const { data: comment, error: fetchError } = await supabase
      .from('activity_comments')
      .select('id, user_id, activity_id')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Check if user is comment author
    const isCommentAuthor = comment.user_id === user.id;

    // Check if user is the post owner (can moderate their own posts)
    let isPostOwner = false;
    if (!isCommentAuthor) {
      const { data: activity } = await supabase
        .from('activities')
        .select('user_id')
        .eq('id', comment.activity_id)
        .single();

      isPostOwner = activity?.user_id === user.id;
    }

    if (!isCommentAuthor && !isPostOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the comment
    const { error: deleteError } = await supabase
      .from('activity_comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      console.error('Delete comment error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/comments/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
