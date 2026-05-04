/**
 * Send the welcome email to every user that hasn't received it yet.
 *
 * Idempotent: skips users where profiles.welcome_email_sent_at IS NOT NULL.
 * Stamps the timestamp on success so re-runs only target newly-onboarded
 * users.
 *
 * Usage:
 *   npx tsx src/scripts/send-welcome-blast.ts --dry-run       # preview only
 *   npx tsx src/scripts/send-welcome-blast.ts                  # send live
 *   npx tsx src/scripts/send-welcome-blast.ts --only=<userId>  # single user
 */
import { readFileSync } from 'fs';
import { join } from 'path';

// ─── Load .env.local ────────────────────────────────────────────────────────
try {
  const envPath = join(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.substring(0, eq).trim();
    const value = trimmed.substring(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  /* missing .env.local handled below */
}

import { createClient } from '@supabase/supabase-js';
import { sendGenericEmail } from '../lib/email';
import { renderWelcomeEmail } from '../emails/welcome';

interface Recipient {
  user_id: string;
  email: string;
  first_name: string | null;
  welcome_email_sent_at: string | null;
}

const BLAST_DELAY_MS = 250; // 4 mails/sec — well under Brevo limits

/**
 * Skip clearly-fake addresses to protect the new sending domain's reputation.
 * Hard-bounces on a fresh domain crater deliverability. We can always
 * re-include with --send-to-test if you really want.
 */
const TEST_DOMAIN_RE = /@(test|example)\.(at|com|de|org)$/i;
const TEST_LOCAL_RE = /^(test|mustermann|mustermax|noreply|admin)\b/i;
function isTestAddress(email: string): boolean {
  return TEST_DOMAIN_RE.test(email) || TEST_LOCAL_RE.test(email);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sendToTest = args.includes('--send-to-test');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const onlyId = onlyArg ? onlyArg.split('=')[1] : undefined;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!process.env.BREVO_API_KEY && !process.env.RESEND_API_KEY) {
    console.error('Missing BREVO_API_KEY (or RESEND_API_KEY) in .env.local');
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lasstreffen.at';

  // Pull pending recipients (auth.users join profiles, where welcome not sent)
  let q = sb
    .from('profiles')
    .select('id, email, first_name, welcome_email_sent_at')
    .is('welcome_email_sent_at', null)
    .not('email', 'is', null);
  if (onlyId) q = q.eq('id', onlyId);

  const { data, error } = await q;
  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  const allRecipients: Recipient[] = (data || []).map((r) => ({
    user_id: r.id,
    email: r.email!,
    first_name: r.first_name,
    welcome_email_sent_at: r.welcome_email_sent_at,
  }));

  const skipped = sendToTest ? [] : allRecipients.filter((r) => isTestAddress(r.email));
  const recipients = sendToTest ? allRecipients : allRecipients.filter((r) => !isTestAddress(r.email));

  if (skipped.length) {
    console.log(`Skipping ${skipped.length} test address(es) (use --send-to-test to override):`);
    for (const s of skipped) console.log(`  · ${s.email}`);
    console.log('');
  }
  console.log(`${recipients.length} pending recipient(s)${dryRun ? ' [DRY RUN]' : ''}`);
  if (!recipients.length) {
    console.log('Nothing to do — all users already received the welcome email.');
    return;
  }

  if (dryRun) {
    for (const r of recipients) {
      console.log(`  would send → ${r.email}  (Hi ${r.first_name || 'there'})`);
    }
    console.log('\nDry-run done. No mails sent, no DB writes.');
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const displayName = (r.first_name || r.email.split('@')[0] || 'there').trim();
    const html = renderWelcomeEmail({
      displayName,
      mapUrl: `${baseUrl}/map`,
      preferencesUrl: `${baseUrl}/settings/notifications`,
      unsubscribeUrl: `${baseUrl}/api/notifications/unsubscribe?user=${r.user_id}`,
    });

    const result = await sendGenericEmail(
      r.email,
      'Willkommen bei LassTreffen!',
      html,
    );

    if (result.success) {
      sent++;
      // Stamp idempotency marker
      const { error: updateErr } = await sb
        .from('profiles')
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq('id', r.user_id);
      if (updateErr) {
        console.error(`  ⚠ ${r.email}: sent ${result.id} but DB stamp failed: ${updateErr.message}`);
      } else {
        console.log(`  ✓ ${r.email}  (id ${result.id})`);
      }
    } else {
      failed++;
      console.error(`  ✗ ${r.email}: ${result.error}`);
    }

    // Polite throttle
    await new Promise((resolve) => setTimeout(resolve, BLAST_DELAY_MS));
  }

  console.log(`\nDone: ${sent} sent, ${failed} failed`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
