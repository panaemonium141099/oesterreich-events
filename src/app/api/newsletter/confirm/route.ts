/**
 * GET /api/newsletter/confirm?email=…&token=… — Double-Opt-in-Bestätigung.
 * Token = HMAC(newsletter-confirm:email) — nicht fälschbar, kein DB-Storage.
 * Antwortet mit einer kleinen HTML-Seite (Link kommt aus der Mail).
 */

import { type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyNewsletterToken } from '@/lib/newsletter';

export const dynamic = 'force-dynamic';

function page(title: string, text: string): Response {
  return new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — LassTreffen.at</title></head>
     <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0c;color:#eee;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
       <div style="max-width:420px;padding:32px;text-align:center;">
         <h1 style="font-size:22px;margin:0 0 12px;">${title}</h1>
         <p style="color:#aaa;line-height:1.6;">${text}</p>
         <a href="https://lasstreffen.at" style="display:inline-block;margin-top:20px;background:#fff;color:#111;padding:10px 20px;border-radius:10px;text-decoration:none;font-weight:600;">Zu den Events</a>
       </div>
     </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase();
  const token = req.nextUrl.searchParams.get('token') ?? '';

  if (!email || !(await verifyNewsletterToken('confirm', email, token))) {
    return page('Link ungültig', 'Dieser Bestätigungslink ist ungültig oder unvollständig. Melde dich einfach erneut an.');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return page('Gerade nicht verfügbar', 'Bitte versuche es später erneut.');
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { error } = await admin
    .from('newsletter_subscribers')
    .update({ confirmed_at: new Date().toISOString(), unsubscribed_at: null })
    .eq('email', email);
  if (error) {
    console.error('[newsletter/confirm] update failed:', error);
    return page('Etwas ist schiefgegangen', 'Bitte versuche den Link später erneut.');
  }

  return page('Anmeldung bestätigt!', 'Ab jetzt bekommst du einmal pro Woche die besten Events deiner Region. Abmelden geht jederzeit mit einem Klick in jeder Mail.');
}
