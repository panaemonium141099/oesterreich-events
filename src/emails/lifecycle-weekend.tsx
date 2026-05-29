/**
 * Lifecycle email — one template, three cohorts.
 *
 *   - 'welcome'      → neu registriert, noch nichts saved/followed
 *                      "Willkommen bei lasstreffen.at"
 *   - 'reactivation' → > 21 Tage nicht eingeloggt
 *                      "Wir vermissen dich"
 *   - 'weekend'      → aktive User, regulärer Freitags-Push
 *                      "Dein Wochenende in {city}"
 *
 * Visual: brand-first (cream paper bg, rust-red accent, warm ink). One hero
 * event at the top with full-bleed image + overlay, then compact cards for
 * the rest. Day-of-week chip + category color-coding give the list a strong
 * scannable rhythm. Logo top + footer for consistent identity.
 *
 * Email-safe: tables, inline styles, no JS, no @media. The logo is loaded
 * over HTTPS (public/email/logo-light.png after deploy) — works in every
 * Gmail/Apple Mail/Outlook variant.
 */

export type LifecycleCohort = 'welcome' | 'reactivation' | 'weekend';

export interface LifecycleEmailEvent {
  title: string;
  /** Pre-formatted, e.g. "Sa, 31. Mai" — used for the meta line. */
  date: string;
  /** Day chip — two lines: weekday abbrev + day-of-month, e.g. { dayName: "SA", dayNum: "31", monthShort: "MAI" }. */
  dayChip?: { dayName: string; dayNum: string; monthShort: string };
  time?: string;
  venueName?: string;
  city?: string;
  imageUrl?: string;
  eventPageUrl: string;
  ticketUrl?: string;
  category?: string;
}

export interface LifecycleEmailData {
  cohort: LifecycleCohort;
  firstName?: string;
  cityName: string;
  events: LifecycleEmailEvent[];
  exploreUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
  /**
   * Absolute URL to the brand logo PNG. Defaults to the production URL.
   * The preview script overrides this with a local file:// URL so screenshots
   * render the logo before deploy.
   */
  logoUrl?: string;
}

// ── Brand tokens (mirror src/components/Brand/Pin.tsx) ──────────────────

const BRAND = {
  accent: '#c8553d',       // rust-red — brand pin color, CTA buttons
  accentDark: '#a8442e',   // darker rust for hover/border
  cream: '#fbf7ec',        // paper bg
  creamSoft: '#f7f1de',    // alt bg for compact cards
  ink: '#1a1410',          // warm-dark text
  inkSoft: '#4b4036',      // muted text
  inkMuted: '#8a7e6f',     // very muted text
  divider: '#e8dfc9',      // cream-tinted divider
} as const;

// Category → accent color. Falls back to brand rust.
const CATEGORY_COLORS: Record<string, string> = {
  Konzert: '#c8553d',
  Festival: '#d97706',
  Genuss: '#65a30d',
  Brunch: '#db2777',
  Stadtfest: '#2563eb',
  Sport: '#059669',
  Markt: '#ea580c',
  Theater: '#7c3aed',
  Kunst: '#9333ea',
  Familie: '#0891b2',
};

function categoryColor(category?: string): string {
  if (!category) return BRAND.ink;
  return CATEGORY_COLORS[category] ?? BRAND.accent;
}

// ── Cohort-specific copy ────────────────────────────────────────────────

interface CohortCopy {
  preheader: string;
  eyebrow: string;
  headline: string;
  sub: string;
  intro: string;
  ctaLabel: string;
  footerNote: string;
}

function cohortCopy(cohort: LifecycleCohort, firstName: string | undefined, cityName: string, count: number): CohortCopy {
  // Defensiv: leere Strings, nur-Whitespace und sehr lange Namen behandeln.
  const trimmed = (firstName ?? '').trim();
  const safeName = trimmed.length > 0 && trimmed.length <= 40 ? escapeHtml(trimmed) : '';
  const city = escapeHtml(cityName);

  switch (cohort) {
    case 'welcome':
      return {
        preheader: `Willkommen bei lasstreffen.at — ${count} handverlesene Events in ${cityName}`,
        eyebrow: 'WILLKOMMEN',
        headline: safeName
          ? `${safeName}, schön dass du da bist.`
          : `Schön, dass du da bist.`,
        sub: `Hier sind ${count} Events aus ${city}, die wir dir nicht vorenthalten wollten.`,
        intro: `lasstreffen.at sammelt Veranstaltungen aus ganz Österreich — Konzerte, Festivals, Märkte, Sport. Speichere was dich interessiert, folge Artists, und wir melden uns bevor die Tickets weg sind.`,
        ctaLabel: 'Mehr aus deiner Region',
        footerNote: 'Diese Begrüßung schicken wir nur einmal — versprochen.',
      };

    case 'reactivation':
      return {
        preheader: `${count} neue Events in ${cityName}, seit du das letzte Mal da warst`,
        eyebrow: 'WIR VERMISSEN DICH',
        headline: safeName
          ? `${safeName}, lang nichts gehört.`
          : `Lang nichts gehört von dir.`,
        sub: `Seit deinem letzten Besuch sind ${count} sehenswerte Veranstaltungen in ${city} dazugekommen.`,
        intro: `Wir wollen nicht aufdringlich sein — wenn dich Events nicht mehr interessieren, ein Klick auf „Abmelden" reicht und du hörst von uns nichts mehr.`,
        ctaLabel: 'Alle Events in deiner Nähe',
        footerNote: 'Du erhältst diese Email weil du länger nicht aktiv warst. Maximal 1× pro 2 Monate.',
      };

    case 'weekend':
    default:
      return {
        preheader: `Dein Wochenende in ${cityName} — ${count} Top-Events`,
        eyebrow: 'WOCHENEND-PICKS',
        headline: safeName
          ? `${safeName}, dein Wochenende in ${city}.`
          : `Dein Wochenende in ${city}.`,
        sub: `${count} Veranstaltungen, die wir dir empfehlen.`,
        intro: '',
        ctaLabel: 'Alle Wochenend-Events',
        footerNote: 'Diese Auswahl bekommst du jeden Donnerstag — abbestellen jederzeit.',
      };
  }
}

// ── Render ──────────────────────────────────────────────────────────────

export function renderLifecycleEmail(data: LifecycleEmailData): { subject: string; html: string } {
  const { cohort, firstName, cityName, events, exploreUrl, unsubscribeUrl, preferencesUrl } = data;
  const logoUrl = data.logoUrl ?? 'https://lasstreffen.at/email/logo-light.png';
  const copy = cohortCopy(cohort, firstName, cityName, events.length);

  const subject =
    cohort === 'welcome'
      ? `Willkommen bei lasstreffen.at — ${events.length} Events in ${cityName}`
      : cohort === 'reactivation'
      ? `Wir vermissen dich — ${events.length} neue Events in ${cityName}`
      : `Dein Wochenende in ${cityName}: ${events.length} Top-Picks`;

  const hero = events[0];
  const rest = events.slice(1);

  const heroBlock = hero ? renderHero(hero) : '';
  const compactBlock = rest.length > 0 ? renderCompactList(rest) : '';

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${BRAND.ink};">

  <!-- Preheader (hidden in body, shown in inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.cream};">${escapeHtml(copy.preheader)}</div>

  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.cream};padding:32px 12px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:${BRAND.cream};">

          <!-- Logo header -->
          <tr>
            <td style="padding:8px 16px 28px;">
              <a href="https://lasstreffen.at" style="text-decoration:none;display:inline-block;">
                <img src="${escapeHtml(logoUrl)}" alt="lasstreffen.at" width="200" height="40" style="display:block;border:0;height:40px;width:auto;max-width:220px;" />
              </a>
            </td>
          </tr>

          <!-- Headline block -->
          <tr>
            <td style="padding:0 16px 20px;">
              <div style="font-size:11px;letter-spacing:2px;font-weight:700;color:${BRAND.accent};margin:0 0 12px;">${escapeHtml(copy.eyebrow)}</div>
              <h1 style="margin:0;font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;color:${BRAND.ink};">
                ${copy.headline}
              </h1>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.5;color:${BRAND.inkSoft};">
                ${copy.sub}
              </p>
              ${
                copy.intro
                  ? `<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:${BRAND.inkMuted};">${copy.intro}</p>`
                  : ''
              }
            </td>
          </tr>

          <!-- Hero event -->
          ${
            heroBlock
              ? `<tr><td style="padding:8px 16px 8px;">${heroBlock}</td></tr>`
              : ''
          }

          <!-- "Weitere Picks" section header -->
          ${
            compactBlock
              ? `
          <tr>
            <td style="padding:24px 16px 8px;">
              <div style="font-size:11px;letter-spacing:2px;font-weight:700;color:${BRAND.inkMuted};border-top:1px solid ${BRAND.divider};padding-top:24px;">
                WEITERE PICKS FÜR DICH
              </div>
            </td>
          </tr>
          <tr><td style="padding:4px 16px 8px;">${compactBlock}</td></tr>
          `
              : ''
          }

          <!-- CTA -->
          <tr>
            <td style="padding:32px 16px 8px;text-align:center;">
              <a href="${escapeHtml(exploreUrl)}" style="display:inline-block;background:${BRAND.accent};color:#ffffff;padding:16px 32px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.01em;">
                ${escapeHtml(copy.ctaLabel)} &nbsp;&rarr;
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:48px 16px 16px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${BRAND.divider};padding-top:24px;">
                <tr>
                  <td style="text-align:center;">
                    <img src="${escapeHtml(logoUrl)}" alt="lasstreffen.at" width="140" height="28" style="display:inline-block;border:0;height:28px;width:auto;max-width:160px;opacity:0.85;margin-bottom:16px;" />
                    <p style="margin:0 0 12px;color:${BRAND.inkMuted};font-size:12px;line-height:1.6;max-width:420px;display:inline-block;">
                      ${escapeHtml(copy.footerNote)}
                    </p>
                    <p style="margin:0;color:${BRAND.inkMuted};font-size:12px;">
                      <a href="${escapeHtml(preferencesUrl)}" style="color:${BRAND.inkSoft};text-decoration:underline;">Einstellungen</a>
                      &nbsp;&middot;&nbsp;
                      <a href="${escapeHtml(unsubscribeUrl)}" style="color:${BRAND.inkSoft};text-decoration:underline;">Abmelden</a>
                      &nbsp;&middot;&nbsp;
                      <a href="https://lasstreffen.at/impressum" style="color:${BRAND.inkSoft};text-decoration:underline;">Impressum</a>
                    </p>
                    <p style="margin:14px 0 0;color:#bdb19f;font-size:11px;">
                      lasstreffen.at &mdash; Österreichs Event-Karte
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

// ── Hero card ───────────────────────────────────────────────────────────

function renderHero(ev: LifecycleEmailEvent): string {
  const catColor = categoryColor(ev.category);
  const dayChip = ev.dayChip ?? inferDayChip(ev.date);
  const ctaHref = ev.ticketUrl ?? ev.eventPageUrl;
  const ctaLabel = ev.ticketUrl ? 'Tickets sichern' : 'Mehr erfahren';

  return `
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BRAND.divider};">
    <tr>
      <td style="padding:0;">
        <a href="${escapeHtml(ev.eventPageUrl)}" style="text-decoration:none;display:block;">
          <img src="${escapeHtml(withSize(ev.imageUrl, 640, 320))}" alt="" width="568" height="280" style="display:block;border:0;width:100%;max-width:568px;height:auto;object-fit:cover;" />
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 22px 22px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            ${
              dayChip
                ? `<td width="64" style="vertical-align:top;padding-right:16px;">
                    <div style="background:${BRAND.cream};border:1px solid ${BRAND.divider};border-radius:10px;text-align:center;padding:8px 4px;">
                      <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:${BRAND.accent};line-height:1;">${escapeHtml(dayChip.dayName)}</div>
                      <div style="font-size:24px;font-weight:800;color:${BRAND.ink};line-height:1.05;margin-top:4px;">${escapeHtml(dayChip.dayNum)}</div>
                      <div style="font-size:9px;font-weight:600;letter-spacing:1px;color:${BRAND.inkMuted};margin-top:2px;">${escapeHtml(dayChip.monthShort)}</div>
                    </div>
                  </td>`
                : ''
            }
            <td style="vertical-align:top;">
              ${
                ev.category
                  ? `<span style="display:inline-block;background:${hexAlpha(catColor, 0.12)};color:${catColor};font-size:11px;font-weight:700;letter-spacing:0.5px;padding:4px 10px;border-radius:999px;text-transform:uppercase;">${escapeHtml(ev.category)}</span>`
                  : ''
              }
              <a href="${escapeHtml(ev.eventPageUrl)}" style="display:block;color:${BRAND.ink};font-size:20px;font-weight:800;line-height:1.25;text-decoration:none;letter-spacing:-0.01em;margin-top:8px;">
                ${escapeHtml(ev.title)}
              </a>
              <div style="color:${BRAND.inkSoft};font-size:13px;line-height:1.6;margin-top:8px;">
                ${ev.time ? `&#128336; ${escapeHtml(ev.time)} Uhr` : ''}
                ${ev.venueName ? `${ev.time ? ' &middot; ' : ''}&#128205; ${escapeHtml(ev.venueName)}` : ev.city ? `${ev.time ? ' &middot; ' : ''}&#128205; ${escapeHtml(ev.city)}` : ''}
              </div>
            </td>
          </tr>
        </table>
        <div style="margin-top:18px;">
          <a href="${escapeHtml(ctaHref)}" style="display:inline-block;background:${BRAND.ink};color:#ffffff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">
            ${ctaLabel} &nbsp;&rarr;
          </a>
        </div>
      </td>
    </tr>
  </table>`;
}

// ── Compact event list ──────────────────────────────────────────────────

function renderCompactList(events: LifecycleEmailEvent[]): string {
  return events
    .map((ev) => {
      const catColor = categoryColor(ev.category);
      const dayChip = ev.dayChip ?? inferDayChip(ev.date);

      return `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;background:${BRAND.creamSoft};border-radius:12px;">
        <tr>
          ${
            dayChip
              ? `<td width="60" style="vertical-align:middle;padding:14px 0 14px 14px;">
                  <div style="text-align:center;">
                    <div style="font-size:10px;font-weight:700;letter-spacing:1.5px;color:${BRAND.accent};line-height:1;">${escapeHtml(dayChip.dayName)}</div>
                    <div style="font-size:22px;font-weight:800;color:${BRAND.ink};line-height:1.05;margin-top:3px;">${escapeHtml(dayChip.dayNum)}</div>
                    <div style="font-size:9px;font-weight:600;letter-spacing:1px;color:${BRAND.inkMuted};margin-top:1px;">${escapeHtml(dayChip.monthShort)}</div>
                  </div>
                </td>`
              : ''
          }
          <td width="72" style="vertical-align:middle;padding:10px 0 10px 12px;">
            <a href="${escapeHtml(ev.eventPageUrl)}" style="display:block;">
              <img src="${escapeHtml(withSize(ev.imageUrl, 144, 144))}" alt="" width="72" height="72" style="display:block;border:0;border-radius:8px;object-fit:cover;width:72px;height:72px;" />
            </a>
          </td>
          <td style="vertical-align:middle;padding:14px 16px;">
            ${
              ev.category
                ? `<div style="font-size:10px;font-weight:700;letter-spacing:0.8px;color:${catColor};text-transform:uppercase;margin-bottom:4px;">${escapeHtml(ev.category)}</div>`
                : ''
            }
            <a href="${escapeHtml(ev.eventPageUrl)}" style="display:block;color:${BRAND.ink};font-size:15px;font-weight:700;line-height:1.3;text-decoration:none;letter-spacing:-0.005em;">
              ${escapeHtml(ev.title)}
            </a>
            <div style="color:${BRAND.inkSoft};font-size:12px;line-height:1.5;margin-top:4px;">
              ${ev.time ? `${escapeHtml(ev.time)} Uhr` : ''}
              ${ev.venueName ? `${ev.time ? ' &middot; ' : ''}${escapeHtml(ev.venueName)}` : ev.city ? `${ev.time ? ' &middot; ' : ''}${escapeHtml(ev.city)}` : ''}
            </div>
          </td>
        </tr>
      </table>`;
    })
    .join('');
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Infer a dayChip from a German date string like "Sa, 31. Mai" — best-effort. */
function inferDayChip(date: string): { dayName: string; dayNum: string; monthShort: string } | undefined {
  // Match "Sa, 31. Mai" or "Mo 1. Juni"
  const m = date.match(/^([A-Za-zäöüÄÖÜ]{2,3})[\s,.]+(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)/);
  if (!m) return undefined;
  const [, weekday, day, month] = m;
  return {
    dayName: weekday.slice(0, 2).toUpperCase(),
    dayNum: day,
    monthShort: month.slice(0, 3).toUpperCase(),
  };
}

/** Convert hex color + alpha to rgba() string for safe email rendering. */
function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Append `?w=…&h=…` to the image proxy URL so the renderer asks for the
 * right slot size (hero 640×320, compact 144×144 — 2× DPI for retina).
 *
 * Defensive: also handles legacy non-proxy URLs (just returns them) so the
 * template stays renderable when called from the local preview script.
 */
function withSize(url: string | undefined, w: number, h: number): string {
  if (!url) return `https://lasstreffen.at/api/img/missing?w=${w}&h=${h}`;
  if (!url.startsWith('https://lasstreffen.at/api/img/')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}w=${w}&h=${h}`;
}
