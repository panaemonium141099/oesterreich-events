import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Async server component die isoliert in einer <Suspense>-Boundary läuft.
 *
 * **Warum getrennt von der Landing-Page:** `supabase.auth.getUser()` macht
 * einen Network-Call zu Supabase Auth (100-500 ms blockierend). In der
 * page.tsx selbst aufgerufen würde das die ganze Landing dynamisch machen
 * und blockieren bis die Antwort da ist — anonyme Visitor (95 % Traffic +
 * Googlebot) zahlten den Preis ohne irgendeinen Nutzen.
 *
 * Mit dieser Komponente in einer Suspense-Boundary streamt Next.js die
 * statische Landing-Hülle SOFORT raus + holt die Auth-Antwort parallel
 * im Hintergrund. Logged-in User bekommen einen Streaming-Redirect zu
 * /feed (Script-Tag, kein 307 — aber funktional identisch). Anonyme User
 * sehen nichts (Komponente returned null).
 *
 * **Failure mode:** Wenn Supabase nicht in 2 s antwortet, fällt der
 * Promise.race auf `null` zurück → Komponente returned null → User bleibt
 * auf der Landing. Identisches Verhalten wie vor dem Refactor (war auch
 * schon mit 2 s Timeout abgesichert).
 */
export async function AuthRedirectGate() {
  try {
    const supabase = await createServerSupabaseClient();
    const userResult = await Promise.race<{ data: { user: unknown | null } } | null>([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    if (userResult?.data?.user) {
      redirect('/feed');
    }
  } catch {
    // Server-side Supabase fetch threw — render anonymously.
  }
  return null;
}
