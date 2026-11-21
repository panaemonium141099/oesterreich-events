import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';

/** Form eines JWT: drei Base64url-Teile. `CRON_SECRET` sieht nicht so aus. */
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Zugangstoken eines angemeldeten Nutzers aus `Authorization: Bearer …`.
 *
 * Die native App hat keine Cookies; sie schickt das Zugangstoken ihrer
 * Supabase-Sitzung in diesem Header. Zurück kommt null für alles, was kein
 * Nutzer-Token ist: kein Header, keine JWT-Form, oder einer der eigenen
 * Schlüssel (Cron-Secret, Anon- und Service-Schlüssel), mit denen sich
 * Cron-Routen und interne Aufrufer ausweisen. Ob das Token gültig ist,
 * entscheidet erst der Auth-Server (`auth.getUser()`).
 */
export function bearerUserToken(authorization: string | null | undefined): string | null {
  const token = /^Bearer\s+(\S+)$/i.exec(authorization?.trim() ?? '')?.[1];
  if (!token || !JWT.test(token)) return null;
  const ownKeys = [
    process.env.CRON_SECRET,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ];
  return ownKeys.includes(token) ? null : token;
}

/**
 * Client im Namen des Nutzers, dem das Token gehört: Datenbank-Abfragen
 * laufen mit seinem Token (RLS wie im Browser), und `auth.getUser()` ohne
 * Argument prüft dieses Token, so wie es die Routen für die Cookie-Sitzung
 * aufrufen. Es gibt keine Sitzung zu speichern oder zu erneuern: das macht
 * die App selbst.
 */
function createBearerClient(token: string) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
  const getUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = ((jwt?: string) => getUser(jwt ?? token)) as typeof client.auth.getUser;
  return client;
}

/**
 * Supabase-Client für Server-Code im Namen des Aufrufers.
 *
 * Website: die Sitzung steht in den `sb-*`-Cookies. Native App: sie schickt
 * ihr Zugangstoken als `Authorization: Bearer …` (siehe `bearerUserToken`).
 * Liegt ein Nutzer-Token vor, gilt es; sonst die Cookies wie bisher.
 */
export async function createServerSupabaseClient() {
  const bearer = bearerUserToken((await headers()).get('authorization'));
  if (bearer) return createBearerClient(bearer);

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
