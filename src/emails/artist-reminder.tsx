/**
 * Artist event reminder email template.
 *
 * 7d: "In 7 Tagen: {Artist} live!"
 * 1d: "Morgen ist es soweit! {Artist} live!"
 *
 * Urgency-driven copy with prominent ticket CTA.
 * GDPR-compliant with unsubscribe link in footer.
 *
 * Task: fn-10-spotify-artist-alerts-follow-artists.8
 */

import type { ArtistReminderEmailData } from '@/lib/email';

/**
 * Render the reminder email as an HTML string.
 * Uses inline styles for maximum email client compatibility.
 */
export function renderArtistReminderEmail(data: ArtistReminderEmailData): string {
  const {
    artistName,
    artistImageUrl,
    eventTitle,
    eventDate,
    eventTime,
    venueName,
    location,
    ticketUrl,
    eventPageUrl,
    unsubscribeUrl,
    preferencesUrl,
    daysUntil,
  } = data;

  const primaryCtaUrl = ticketUrl ?? eventPageUrl;
  const is1Day = daysUntil === 1;

  // Urgency-driven copy
  const urgencyHeader = is1Day ? 'Morgen ist es soweit!' : `Noch ${daysUntil} Tage!`;
  const ctaText = is1Day
    ? 'Letzte Chance \u2014 Tickets sichern!'
    : 'Sichere dir jetzt deine Tickets';
  const ctaFallbackText = is1Day
    ? 'Letzte Chance \u2014 Event ansehen!'
    : 'Event-Details ansehen';
  const primaryCtaText = ticketUrl ? ctaText : ctaFallbackText;

  const urgencyBgColor = is1Day ? '#dc2626' : '#f59e0b';
  const urgencyTextColor = is1Day ? '#ffffff' : '#78350f';

  const heroImage = artistImageUrl
    ? `<img src="${escapeHtml(artistImageUrl)}" alt="${escapeHtml(artistName)}" width="600" height="300" style="width:100%;max-width:600px;height:auto;border-radius:12px 12px 0 0;display:block;object-fit:cover;" />`
    : `<div style="width:100%;height:200px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px 12px 0 0;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:48px;color:#fff;font-weight:700;">${escapeHtml(artistName.charAt(0))}</span>
      </div>`;

  const timeRow = eventTime
    ? `<tr>
        <td style="padding:4px 0;color:#6b7280;font-size:14px;width:24px;vertical-align:top;">&#128336;</td>
        <td style="padding:4px 0 4px 8px;color:#374151;font-size:14px;">${escapeHtml(eventTime)} Uhr</td>
      </tr>`
    : '';

  const venueRow = venueName
    ? `<tr>
        <td style="padding:4px 0;color:#6b7280;font-size:14px;width:24px;vertical-align:top;">&#127963;</td>
        <td style="padding:4px 0 4px 8px;color:#374151;font-size:14px;">${escapeHtml(venueName)}</td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${is1Day ? 'Morgen' : `In ${daysUntil} Tagen`}: ${escapeHtml(artistName)} live!</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f3f4f6;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Urgency banner -->
          <tr>
            <td style="padding:12px 32px;background-color:${urgencyBgColor};text-align:center;">
              <p style="margin:0;font-size:14px;font-weight:700;color:${urgencyTextColor};letter-spacing:0.5px;text-transform:uppercase;">
                ${urgencyHeader}
              </p>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td>
              ${heroImage}
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:24px 32px;">
              <!-- Title -->
              <h1 style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">
                ${escapeHtml(artistName)} live ${is1Day ? 'morgen' : `in ${daysUntil} Tagen`}!
              </h1>
              <p style="margin:0 0 20px;font-size:15px;color:#6b7280;line-height:1.5;">
                ${is1Day ? 'Vergiss nicht \u2014 das Event ist morgen!' : 'Dein Event rueckt naeher. Hast du schon Tickets?'}
              </p>

              <!-- Event title -->
              <p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#1f2937;">
                ${escapeHtml(eventTitle)}
              </p>

              <!-- Event details -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:14px;width:24px;vertical-align:top;">&#128197;</td>
                  <td style="padding:4px 0 4px 8px;color:#374151;font-size:14px;">${escapeHtml(eventDate)}</td>
                </tr>
                ${timeRow}
                ${venueRow}
                <tr>
                  <td style="padding:4px 0;color:#6b7280;font-size:14px;width:24px;vertical-align:top;">&#128205;</td>
                  <td style="padding:4px 0 4px 8px;color:#374151;font-size:14px;">${escapeHtml(location)}</td>
                </tr>
              </table>

              <!-- Primary CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(primaryCtaUrl)}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:${is1Day ? '#dc2626' : '#6366f1'};color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;border-radius:8px;line-height:1;">
                      ${primaryCtaText}
                    </a>
                  </td>
                </tr>
              </table>

              ${ticketUrl ? `
              <!-- Secondary link -->
              <p style="margin:16px 0 0;text-align:center;">
                <a href="${escapeHtml(eventPageUrl)}" target="_blank" style="color:#6366f1;font-size:14px;text-decoration:underline;">
                  Event-Details ansehen
                </a>
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
                Du erhaeltst diese E-Mail, weil du ${escapeHtml(artistName)} auf
                <a href="https://osterreich.events" style="color:#6366f1;text-decoration:none;">osterreich.events</a> folgst.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#9ca3af;text-decoration:underline;">E-Mail-Benachrichtigungen abbestellen</a>
                &nbsp;&middot;&nbsp;
                <a href="${escapeHtml(preferencesUrl)}" style="color:#9ca3af;text-decoration:underline;">Benachrichtigungen verwalten</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
