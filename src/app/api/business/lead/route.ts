/**
 * POST /api/business/lead
 *
 * Öffentliches Lead-Formular für den /fuer-firmen Katalog. Firmen sind hier
 * NICHT eingeloggt — der Insert läuft daher über die Service-Role (umgeht RLS,
 * siehe migration 20260610_business_leads.sql). Zusätzlich geht eine
 * Benachrichtigungs-E-Mail an den Betreiber raus.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendGenericEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const NOTIFY_TO = process.env.BUSINESS_LEADS_EMAIL || 'dev@glatzdev.com';

const VALID_PLANS = ['boost', 'abo', 'scraper', 'unsure'] as const;
type Plan = (typeof VALID_PLANS)[number];

const PLAN_LABEL: Record<Plan, string> = {
  boost: 'Event-Boost (einzeln)',
  abo: 'Business-Abo',
  scraper: 'Live-Anbindung (Scraper)',
  unsure: 'Noch unsicher / Beratung',
};

// Sehr lockere E-Mail-Validierung — wir wollen Leads nicht wegen Edge-Cases verlieren.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clamp(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Ungültige Anfrage' }, { status: 400 });
  }

  const company = clamp(body.company, 200);
  const contactName = clamp(body.contactName, 200);
  const email = clamp(body.email, 320);
  const phone = clamp(body.phone, 50);
  const website = clamp(body.website, 500);
  const message = clamp(body.message, 4000);
  const planRaw = typeof body.plan === 'string' ? body.plan : 'unsure';
  const plan: Plan = (VALID_PLANS as readonly string[]).includes(planRaw)
    ? (planRaw as Plan)
    : 'unsure';

  if (!company || !contactName || !email) {
    return NextResponse.json(
      { error: 'Firma, Name und E-Mail sind erforderlich.' },
      { status: 400 }
    );
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json(
      { error: 'Bitte eine gültige E-Mail-Adresse angeben.' },
      { status: 400 }
    );
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('business_leads')
    .insert({
      company,
      contact_name: contactName,
      email,
      phone,
      website,
      plan,
      message,
      user_agent: userAgent,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[business/lead] insert failed:', error);
    return NextResponse.json(
      { error: 'Anfrage konnte nicht gespeichert werden. Bitte später erneut versuchen.' },
      { status: 500 }
    );
  }

  // Benachrichtigung an den Betreiber — Fehler hier dürfen das Lead nicht killen.
  try {
    const html = `
      <h2>Neue Firmen-Anfrage</h2>
      <p><strong>Paket:</strong> ${PLAN_LABEL[plan]}</p>
      <p><strong>Firma:</strong> ${escapeHtml(company)}</p>
      <p><strong>Ansprechpartner:</strong> ${escapeHtml(contactName)}</p>
      <p><strong>E-Mail:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
      ${phone ? `<p><strong>Telefon:</strong> ${escapeHtml(phone)}</p>` : ''}
      ${website ? `<p><strong>Website:</strong> <a href="${escapeHtml(website)}">${escapeHtml(website)}</a></p>` : ''}
      ${message ? `<p><strong>Nachricht:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</p>` : ''}
      <hr>
      <p style="color:#888;font-size:12px">Lead-ID: ${data.id}</p>
    `;
    await sendGenericEmail(NOTIFY_TO, `Neue Firmen-Anfrage: ${company} (${PLAN_LABEL[plan]})`, html);
  } catch (err) {
    console.error('[business/lead] notification email failed:', err);
  }

  return NextResponse.json({ ok: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
