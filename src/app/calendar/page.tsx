import { requireUserOrRedirect } from '@/lib/supabase/require-user';
import { CalendarPageClient } from './CalendarPageClient';

/**
 * /calendar — user's personal event calendar.
 *
 * Server-side auth-gate before any UI renders. Anonymous visitors get
 * a 307 to /auth/login with ?returnTo=/calendar. The client component
 * keeps its defensive `!loading && !user` effect for mid-session
 * logouts from another tab.
 */
export default async function CalendarPage() {
  await requireUserOrRedirect('/calendar');
  return <CalendarPageClient />;
}
