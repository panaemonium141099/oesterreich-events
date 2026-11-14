import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { notifyOperator } from '@/lib/notify-operator';
import { escapeHtml } from '@/lib/utils/escape-html';

export const dynamic = 'force-dynamic';

/**
 * POST /api/comments/[id]/report
 * Report a comment. Creates a notification for all god-role users.
 * Body: { reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: commentId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = (body as { reason?: string }).reason?.trim() || '';

    // Fetch the comment with user info
    const { data: comment, error: fetchError } = await supabase
      .from('activity_comments')
      .select('id, content, user_id, activity_id, user:profiles!activity_comments_user_id_fkey(first_name, last_name)')
      .eq('id', commentId)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    // Don't allow reporting own comments
    if (comment.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot report own comment' }, { status: 400 });
    }

    // Fetch reporter's profile
    const { data: reporterProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    const reporterName = [reporterProfile?.first_name, reporterProfile?.last_name].filter(Boolean).join(' ') || 'Ein Nutzer';
    const commentUser = Array.isArray(comment.user) ? comment.user[0] : comment.user;
    const commenterName = [commentUser?.first_name, commentUser?.last_name].filter(Boolean).join(' ') || 'Unbekannt';

    // Build notification body
    const truncatedContent = comment.content.length > 100 ? comment.content.slice(0, 100) + '...' : comment.content;
    const notificationBody = reason
      ? `Kommentar von ${commenterName}: "${truncatedContent}"\nGrund: ${reason}`
      : `Kommentar von ${commenterName}: "${truncatedContent}"`;

    // Zusätzlich per Mail an den Betreiber: die In-App-Meldung sieht nur,
    // wer eingeloggt in die Glocke schaut. Vor der god-Abfrage, damit die
    // Meldung auch ohne god-Nutzer ankommt.
    await notifyOperator({
      context: `comment-report:${commentId}`,
      subject: 'Kommentar gemeldet',
      html: `
        <h2>Ein Kommentar wurde gemeldet</h2>
        <p><strong>Gemeldet von:</strong> ${escapeHtml(reporterName)}</p>
        <p><strong>Kommentar von:</strong> ${escapeHtml(commenterName)}</p>
        <p><strong>Inhalt:</strong> ${escapeHtml(truncatedContent)}</p>
        ${reason ? `<p><strong>Grund:</strong> ${escapeHtml(reason)}</p>` : ''}
        <p><a href="https://lasstreffen.at/feed/${escapeHtml(String(comment.activity_id))}">Zum Beitrag</a></p>
      `,
    });

    // Fetch all god-role users
    const { data: godUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'god');

    if (!godUsers || godUsers.length === 0) {
      console.warn('No god users found to receive comment report');
      return NextResponse.json({ success: true });
    }

    // Create a notification for each god user
    const notifications = godUsers.map(god => ({
      user_id: god.id,
      from_user_id: user.id,
      type: 'comment_report',
      title: `${reporterName} hat einen Kommentar gemeldet`,
      body: notificationBody,
      action_url: `/feed/${comment.activity_id}`,
      read: false,
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('Error creating report notifications:', insertError);
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/comments/[id]/report error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
