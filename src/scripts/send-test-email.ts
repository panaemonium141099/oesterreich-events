/**
 * Send a test welcome email to a target address.
 *
 * Usage:
 *   npx tsx src/scripts/send-test-email.ts                      # default: jona.glatz@gmail.com
 *   npx tsx src/scripts/send-test-email.ts --to=foo@bar.com
 *   npx tsx src/scripts/send-test-email.ts --to=foo@bar.com --name="Max"
 *
 * Reads BREVO_API_KEY (preferred) or RESEND_API_KEY from .env.local.
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
} catch (e) {
  console.error('No .env.local found — Brevo / Resend keys must be in your shell env');
}

import { sendGenericEmail } from '../lib/email';
import { renderWelcomeEmail } from '../emails/welcome';

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string, def: string): string => {
    const a = args.find((x) => x.startsWith(flag + '='));
    return a ? a.substring(flag.length + 1) : def;
  };

  const to = get('--to', 'jona.glatz@gmail.com');
  const displayName = get('--name', 'Jona');
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lasstreffen.at';

  if (!process.env.BREVO_API_KEY && !process.env.RESEND_API_KEY) {
    console.error('Missing BREVO_API_KEY (or RESEND_API_KEY) in .env.local');
    console.error('  Add to .env.local:');
    console.error('    BREVO_API_KEY=xkeysib-...');
    console.error('    EMAIL_FROM=noreply@lasstreffen.at');
    console.error('    EMAIL_FROM_NAME=LassTreffen!');
    process.exit(1);
  }

  const provider = process.env.BREVO_API_KEY ? 'Brevo' : 'Resend (fallback)';
  console.log(`Sending welcome test mail via ${provider}`);
  console.log(`  To:   ${to}`);
  console.log(`  Name: ${displayName}`);
  console.log(`  From: ${process.env.EMAIL_FROM_NAME || 'LassTreffen!'} <${process.env.EMAIL_FROM || 'noreply@lasstreffen.at'}>`);

  const html = renderWelcomeEmail({
    displayName,
    mapUrl: `${baseUrl}/map`,
    preferencesUrl: `${baseUrl}/settings/notifications`,
    unsubscribeUrl: `${baseUrl}/api/notifications/unsubscribe?token=test`,
  });

  const result = await sendGenericEmail(
    to,
    'Willkommen bei LassTreffen!',
    html,
  );

  if (result.success) {
    console.log(`\n✓ Sent! Message ID: ${result.id}`);
  } else {
    console.error(`\n✗ Failed: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
