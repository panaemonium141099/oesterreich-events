#!/usr/bin/env node
/**
 * infra/scripts/gen-keys.mjs — erzeugt JWT_SECRET + anon/service_role Keys (fn-19)
 *
 *   node infra/scripts/gen-keys.mjs            # neues Secret + beide Keys
 *   node infra/scripts/gen-keys.mjs --secret X # Keys fuer vorhandenes Secret
 *
 * Hintergrund: `anon` und `service_role` sind bei Supabase keine
 * Zufalls-Strings, sondern HS256-JWTs mit einem `role`-Claim, signiert mit dem
 * JWT_SECRET der Instanz. PostgREST liest den Claim und setzt darueber die
 * Postgres-Rolle — daran haengen die 33 RLS-Policies und die 74
 * `auth.uid()`-Referenzen im Schema.
 *
 * Self-hosted erzeugen wir Secret und Keys einmalig selbst. Alle drei Dienste
 * (PostgREST, GoTrue, Storage) MUESSEN dasselbe JWT_SECRET benutzen, sonst
 * akzeptiert der eine die Tokens des anderen nicht.
 *
 * KONSEQUENZ: Mit einem neuen Secret werden alle 56 bestehenden Sessions
 * ungueltig. Die User muessen sich einmal neu einloggen. Das ist der
 * erwartete, dokumentierte Nebeneffekt des Umzugs.
 *
 * Nutzt `jose` aus den Projekt-Dependencies (^6.2.2) — keine neue Abhaengigkeit.
 */

import { randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';

const args = process.argv.slice(2);
const secretArgIndex = args.indexOf('--secret');

/**
 * Supabase Cloud nutzt 40 Zeichen. Weniger als 32 Byte Entropie waere bei
 * HS256 fahrlaessig — dieses Secret schuetzt den gesamten DB-Zugriff.
 */
const jwtSecret =
  secretArgIndex !== -1
    ? args[secretArgIndex + 1]
    : randomBytes(30).toString('base64url').slice(0, 40);

if (!jwtSecret || jwtSecret.length < 32) {
  console.error('FEHLER: JWT_SECRET muss mindestens 32 Zeichen haben.');
  process.exit(1);
}

/**
 * 10 Jahre. Diese Keys sind Infrastruktur-Konstanten, keine User-Sessions —
 * sie stehen in der Vercel-/systemd-Env und im Client-Bundle (anon).
 * Ein Ablauf mitten im Betrieb waere ein stiller Totalausfall.
 */
const TEN_YEARS_S = 60 * 60 * 24 * 365 * 10;
const iat = Math.floor(Date.now() / 1000);
const key = new TextEncoder().encode(jwtSecret);

async function signRole(role) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('supabase')
    .setIssuedAt(iat)
    .setExpirationTime(iat + TEN_YEARS_S)
    .sign(key);
}

const anonKey = await signRole('anon');
const serviceKey = await signRole('service_role');

/**
 * Zusaetzliche Secrets, die der self-hosted Stack braucht und die Supabase
 * Cloud bisher fuer uns verwaltet hat.
 */
const pgPassword = randomBytes(24).toString('base64url');
const secretKeyBase = randomBytes(32).toString('hex'); // Realtime (Phoenix)
const vaultEncKey = randomBytes(16).toString('hex'); // Storage/Vault, 32 Zeichen

console.log(`
# ============================================================================
# fn-19 — generierte Secrets. EINMALIG erzeugen, dann sicher aufbewahren.
# Diese Werte gehoeren in DREI getrennte Speicher (CLAUDE.md: "Deployment"):
#   1. /opt/supabase/docker/.env        (Docker-Stack)
#   2. /etc/lasstreffen/web.env         (Next.js via systemd)
#   3. GitHub-Actions-Secrets           (Scrape-Pipeline + Eventim-Import)
# NIE ins Repo committen. Das Eventim-Feed-Passwort stand bis 08.07. in der
# public History — dieser Fehler darf sich hier nicht wiederholen.
# ============================================================================

POSTGRES_PASSWORD=${pgPassword}
JWT_SECRET=${jwtSecret}
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceKey}
SECRET_KEY_BASE=${secretKeyBase}
VAULT_ENC_KEY=${vaultEncKey}

# --- Fuer /etc/lasstreffen/web.env (Next.js) --------------------------------
NEXT_PUBLIC_SUPABASE_URL=https://db.lasstreffen.at
SUPABASE_URL=https://db.lasstreffen.at
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceKey}
SUPABASE_JWT_SECRET=${jwtSecret}
`);
